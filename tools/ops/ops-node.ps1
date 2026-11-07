<#
  C (Windows) ops node: frpc + read-only agent under one bounded-restart supervisor.

    powershell -File tools\ops\ops-node.ps1 status
    powershell -File tools\ops\ops-node.ps1 start      # needs secrets\ops-frp\bundles\pc and frpc.exe installed
    powershell -File tools\ops\ops-node.ps1 stop
    powershell -File tools\ops\ops-node.ps1 install-frpc   # official v0.71.1 zip, sha256-pinned (owner runs)

  Workspace paths come from iridescently-workspace.json (found by walking up from this script), never
  from a hard-coded drive. Runtime state: <workspace>\runtime\ops\{state,logs}. Secrets:
  <workspace>\secrets\ops and secrets\ops-frp. Autostart is off, like every other autostart on C.
  Started through WMI (Win32_Process.Create) for the same reason as Start-LAB: the process must not
  belong to the job object of the shell or remote session that launched it.
#>
param([Parameter(Mandatory = $true)][ValidateSet('status', 'start', 'stop', 'install-frpc')][string]$Action)
$ErrorActionPreference = 'Stop'

$FrpVersion = '0.71.1'
$FrpZipSha256 = 'b90074b2b6a1d792a7a40f085ac6d276bcab2d1bc60201f8a86ca53ce65ce821'

function Find-Workspace {
    $d = Split-Path -Parent $PSCommandPath
    while ($d) {
        if (Test-Path (Join-Path $d 'iridescently-workspace.json')) { return $d }
        $p = Split-Path -Parent $d
        if ($p -eq $d) { break }
        $d = $p
    }
    throw 'iridescently-workspace.json not found above this script'
}

$Ws = Find-Workspace
$Repo = Resolve-Path (Join-Path (Split-Path -Parent $PSCommandPath) '..\..')
$OpsRuntime = Join-Path $Ws 'runtime\ops'
$State = Join-Path $OpsRuntime 'state'
$Logs = Join-Path $OpsRuntime 'logs'
$Bundle = Join-Path $Ws 'secrets\ops-frp\bundles\pc'
$FrpDir = Join-Path $OpsRuntime "bin\frp_${FrpVersion}_windows_amd64"
$Frpc = Join-Path $FrpDir 'frpc.exe'
$AgentCfg = Join-Path $Ws 'secrets\ops\agent-pc.json'
$LabPython = Join-Path $Ws 'labs\zszm-lab-v2\server\.venv\Scripts\pythonw.exe'
$Python = if (Test-Path $LabPython) { $LabPython } else { (Get-Command pythonw.exe -ErrorAction Stop).Source }

function Read-Status {
    $f = Join-Path $State 'ops-supervisor.json'
    if (-not (Test-Path $f)) { return $null }
    try { return Get-Content $f -Raw | ConvertFrom-Json } catch { return $null }
}

switch ($Action) {
    'status' {
        $s = Read-Status
        $fresh = $s -and $s.phase -eq 'running' -and (([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() - [double]$s.updated) -lt 10)
        "supervisor: " + $(if ($fresh) { 'running' } elseif ($s) { $s.phase + ' (stale)' } else { 'not started' })
        if ($s -and $s.children) { $s.children.PSObject.Properties | ForEach-Object { "  {0}: alive={1} failed={2} restarts={3}" -f $_.Name, $_.Value.alive, $_.Value.failed, $_.Value.restarts } }
        "frpc.exe: " + $(if (Test-Path $Frpc) { $Frpc } else { 'not installed (install-frpc)' })
        "pc bundle: " + $(if (Test-Path (Join-Path $Bundle 'frpc-pc.toml')) { $Bundle } else { 'missing (infra/frp/bundle.py)' })
        "agent config: " + $(if (Test-Path $AgentCfg) { $AgentCfg } else { 'missing (copy services/ops/config/agent-pc.example.json)' })
        $sshd = Get-Service sshd -ErrorAction SilentlyContinue
        "windows sshd: " + $(if ($sshd) { "$($sshd.Status) / $($sshd.StartType)" } else { 'NOT INSTALLED' })
        try {
            $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri 'http://127.0.0.1:18410/v1/health' -Proxy $null
            "agent: $($r.Content)"
        } catch { 'agent: not answering on 127.0.0.1:18410' }
    }
    'start' {
        $s = Read-Status
        if ($s -and $s.phase -eq 'running' -and (([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() - [double]$s.updated) -lt 10)) { 'already running'; break }
        foreach ($need in @($AgentCfg)) { if (-not (Test-Path $need)) { throw "missing $need" } }
        New-Item -ItemType Directory -Force $State, $Logs | Out-Null
        $cfg = @{ state_dir = $State; log_dir = $Logs; agent_config = $AgentCfg }
        if ((Test-Path $Frpc) -and (Test-Path (Join-Path $Bundle 'frpc-pc.toml'))) {
            & $Frpc verify -c (Join-Path $Bundle 'frpc-pc.toml')
            if ($LASTEXITCODE -ne 0) { throw 'frpc verify failed' }
            $cfg.frpc_exe = $Frpc; $cfg.frpc_config = (Join-Path $Bundle 'frpc-pc.toml')
        } else { 'frpc not installed or bundle missing: starting the agent only (local-only)' }
        $cfgFile = Join-Path $State 'supervise.json'
        $cfg | ConvertTo-Json | Set-Content -Encoding utf8 $cfgFile
        $cmd = "`"$Python`" -B -m opsnode.supervise --config `"$cfgFile`""
        $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = (Join-Path $Repo 'services\ops') }
        if ($r.ReturnValue -ne 0) { throw "Win32_Process.Create failed: $($r.ReturnValue)" }
        "started supervisor pid=$($r.ProcessId)"
    }
    'stop' {
        New-Item -ItemType Directory -Force $State | Out-Null
        Set-Content -Path (Join-Path $State 'stop.request') -Value (Get-Date -Format o)
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Milliseconds 500
            $s = Read-Status
            if (-not $s -or $s.phase -eq 'stopped') { 'stopped'; return }
        }
        'supervisor did not confirm stop within 15 s; check runtime\ops\logs\ops-supervisor.log'
    }
    'install-frpc' {
        $zip = Join-Path $env:TEMP "frp_${FrpVersion}_windows_amd64.zip"
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/fatedier/frp/releases/download/v$FrpVersion/frp_${FrpVersion}_windows_amd64.zip" -OutFile $zip
        $h = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower()
        if ($h -ne $FrpZipSha256) { Remove-Item $zip; throw "sha256 mismatch: $h" }
        New-Item -ItemType Directory -Force (Split-Path -Parent $FrpDir) | Out-Null
        Expand-Archive -Force $zip (Split-Path -Parent $FrpDir)
        Remove-Item $zip
        & $Frpc -v
    }
}
