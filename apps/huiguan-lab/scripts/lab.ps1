param(
    [Parameter(Position = 0)][ValidateSet('start', 'stop', 'restart', 'status', 'install', 'backup', 'restore', 'update', 'autostart', 'build')][string]$Command = 'status',
    [Parameter(Position = 1)][string]$Arg = ''
)
# 西木会馆 LAB V2 control script. All paths are relative to this LAB folder; nothing here touches
# Hong Kong production, other tunnels or other services.
$ErrorActionPreference = 'Stop'
$Lab = Split-Path -Parent $PSScriptRoot
$Server = Join-Path $Lab 'server'
$Py = Join-Path $Server '.venv\Scripts\python.exe'
$Pyw = Join-Path $Server '.venv\Scripts\pythonw.exe'
function Cfg { & $Py -c "import sys,json; sys.path.insert(0, r'$Server'); from lab import config; c=config.load(); print(json.dumps({'runtime':str(c.runtime),'port':c.port,'admin':c.admin_port,'secrets':str(c.secrets),'r4':str(c.r4_python)}))" | ConvertFrom-Json }
function State($c) { $f = Join-Path $c.runtime 'state\supervisor.json'; if (Test-Path $f) { Get-Content -Raw $f | ConvertFrom-Json } }
function Running($c) {
    $s = State $c
    if (!$s -or $s.phase -eq 'stopped') { return $false }
    return [bool](Get-Process -Id $s.supervisor_pid -ErrorAction SilentlyContinue)
}
function Health($c) { try { (Invoke-RestMethod "http://127.0.0.1:$($c.port)/healthz" -TimeoutSec 3).ok } catch { $false } }

switch ($Command) {
    'install' {
        Write-Host '== 检查依赖'
        if (!(Get-Command uv -ErrorAction SilentlyContinue)) { throw '需要 uv（https://docs.astral.sh/uv/）' }
        if (!(Test-Path $Py)) { uv venv --python 3.12 (Join-Path $Server '.venv') }
        uv pip install --python $Py -r (Join-Path $Server 'requirements.txt')
        $c = Cfg
        if (!(Test-Path $c.r4)) { Write-Warning "R4 Python 不存在：$($c.r4)。LAB 将无法启动世界模拟（可在 lab.config.json 设 r4_enabled=false）" }
        if (!(Get-Command cloudflared -ErrorAction SilentlyContinue)) { Write-Warning '未找到 cloudflared：LAB 只能本机访问' }
        & $Py -B (Join-Path $Server 'labctl.py') status
        if (!(Test-Path (Join-Path $c.secrets 'admin.json'))) {
            Write-Host '== 设置管理员密码（管理台 http://127.0.0.1:' $c.admin '）'
            & $Py -B (Join-Path $Server 'labctl.py') admin-password
        }
        Write-Host '安装完成。'
    }
    'start' {
        $c = Cfg
        if (Running $c) { Write-Host 'LAB 已在运行，不会重复启动。'; break }
        # Launch through WMI so the LAB does not live inside the caller's job object: a terminal,
        # IDE or agent session that closes would otherwise take the whole LAB down with it.
        $cmdline = '"' + $Pyw + '" -B "' + (Join-Path $Server 'supervisor.py') + '"'
        $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmdline; CurrentDirectory = $Server }
        if ($r.ReturnValue -ne 0) { throw "无法启动监督进程（Win32_Process.Create 返回 $($r.ReturnValue)）" }
        $p = Get-Process -Id $r.ProcessId -ErrorAction SilentlyContinue
        $deadline = (Get-Date).AddSeconds(60)
        while (!(Health $c)) {
            if (!$p -or $p.HasExited) { throw "LAB 启动失败，查看 $($c.runtime)\logs\supervisor.log" }
            if ((Get-Date) -gt $deadline) { throw "LAB 60 秒内未就绪，查看 $($c.runtime)\logs" }
            Start-Sleep -Milliseconds 500
        }
        Write-Host "LAB 已启动：本机 http://127.0.0.1:$($c.port)/ ，管理台 http://127.0.0.1:$($c.admin)/ ，外网 https://pc-lab.iridescently.cn/"
    }
    'stop' {
        $c = Cfg
        if (!(Running $c)) { Write-Host 'LAB 未运行。'; break }
        $s = State $c
        New-Item -ItemType File -Force (Join-Path $c.runtime 'state\stop.request') | Out-Null
        $deadline = (Get-Date).AddSeconds(30)
        while (Get-Process -Id $s.supervisor_pid -ErrorAction SilentlyContinue) {
            if ((Get-Date) -gt $deadline) {
                Write-Warning '监督进程 30 秒内未退出，强制结束 LAB 进程树'
                foreach ($id in @($s.pids.PSObject.Properties.Value) + $s.supervisor_pid) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
                break
            }
            Start-Sleep -Milliseconds 500
        }
        Write-Host 'LAB 已停止。共享世界保存在' $c.runtime
    }
    'restart' { & $PSCommandPath stop; & $PSCommandPath start }
    'status' {
        $c = Cfg
        $s = State $c
        Write-Host ('运行中: ' + (Running $c) + '   网关健康: ' + (Health $c))
        if ($s -and !(Running $c)) { Write-Host '（下列进程状态是上次运行留下的记录，监督进程已不在：LAB 被外部结束，需要重新 Start-LAB）' }
        if ($s) { $s.children.PSObject.Properties | ForEach-Object { '{0,-8} alive={1} failed={2} restarts={3} last_exit={4}' -f $_.Name, $_.Value.alive, $_.Value.failed, $_.Value.restarts, $_.Value.last_exit } }
        & $Py -B (Join-Path $Server 'labctl.py') status
        $task = Get-ScheduledTask -TaskName 'ZSZM-LAB-V2' -ErrorAction SilentlyContinue
        Write-Host ('开机自启: ' + $(if ($task) { $task.State } else { '未启用（可选：lab.ps1 autostart on）' }))
    }
    'backup' { & $Py -B (Join-Path $Server 'labctl.py') backup --label manual }
    'restore' {
        if (!$Arg) { throw '用法：Restore-LAB.cmd <备份目录>' }
        $c = Cfg
        $was = Running $c
        if ($was) { & $PSCommandPath stop }
        & $Py -B (Join-Path $Server 'labctl.py') restore $Arg --yes
        if ($was) { & $PSCommandPath start }
    }
    'build' {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-web.ps1')
    }
    'update' {
        $c = Cfg
        & $Py -B (Join-Path $Server 'labctl.py') backup --label pre-update
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-web.ps1')
        if ($LASTEXITCODE -ne 0) { throw 'Web 构建失败，未重启 LAB' }
        & $Py -m pytest -q (Join-Path $Server 'tests')
        if ($LASTEXITCODE -ne 0) { throw '测试失败，未重启 LAB' }
        if (Running $c) { & $PSCommandPath restart }
    }
    'autostart' {
        if ($Arg -eq 'on') {
            $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`" start"
            $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
            $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 0)
            Register-ScheduledTask -TaskName 'ZSZM-LAB-V2' -Action $action -Trigger $trigger -Settings $settings -Description '西木会馆 LAB V2（可选自启，单实例由文件锁保证）' -Force | Out-Null
            Write-Host '已启用登录后自动启动 LAB。'
        } elseif ($Arg -eq 'off') {
            Unregister-ScheduledTask -TaskName 'ZSZM-LAB-V2' -Confirm:$false -ErrorAction SilentlyContinue
            Write-Host '已关闭 LAB 自动启动。'
        } else { throw '用法：lab.ps1 autostart on|off' }
    }
}
