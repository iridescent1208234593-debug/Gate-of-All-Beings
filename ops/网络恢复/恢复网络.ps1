param([switch]$DiagnoseOnly, [switch]$Restore, [switch]$NoPause)
$ErrorActionPreference = 'Stop'
$dataDir = Join-Path $env:APPDATA 'io.github.clash-verge-rev.clash-verge-rev'
$logDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$log = Join-Path $logDir "$stamp.log"
$exitCode = 0
Start-Transcript -Path $log -Force | Out-Null

# Use Verge's existing local named pipe; no public controller or credentials in logs.
function Invoke-Core([string]$Method, [string]$Path, [string]$Body = '') {
    $pipe = New-Object System.IO.Pipes.NamedPipeClientStream('.', $script:pipeName,
        [System.IO.Pipes.PipeDirection]::InOut, [System.IO.Pipes.PipeOptions]::Asynchronous)
    $memory = New-Object System.IO.MemoryStream
    try {
        $pipe.Connect(5000)
        $auth = if ($script:secret) { "Authorization: Bearer $script:secret`r`n" } else { '' }
        $payload = [Text.Encoding]::UTF8.GetBytes($Body)
        $header = "$Method $Path HTTP/1.1`r`nHost: localhost`r`n${auth}Connection: close`r`nContent-Type: application/json`r`nContent-Length: $($payload.Length)`r`n`r`n"
        $bytes = [Text.Encoding]::ASCII.GetBytes($header)
        $pipe.Write($bytes, 0, $bytes.Length)
        if ($payload.Length) { $pipe.Write($payload, 0, $payload.Length) }
        $pipe.Flush()
        $buffer = New-Object byte[] 8192
        do {
            $task = $pipe.ReadAsync($buffer, 0, $buffer.Length)
            if (-not $task.Wait(30000)) { throw 'Mihomo API read timed out; configuration may have applied. Run -DiagnoseOnly to check.' }
            $count = $task.Result
            if ($count) { $memory.Write($buffer, 0, $count) }
            $peek = [Text.Encoding]::ASCII.GetString($memory.ToArray())
            $headerEnd = $peek.IndexOf("`r`n`r`n")
            if ($headerEnd -ge 0) {
                $head = $peek.Substring(0, $headerEnd)
                if ($head -match '^HTTP/1\.[01] (204|304)\b') { break }
                if ($head -match '(?im)^Content-Length:\s*(\d+)\s*$' -and
                    $memory.Length -ge ($headerEnd + 4 + [int]$Matches[1])) { break }
                if ($head -match '(?i)Transfer-Encoding:\s*chunked' -and $peek.EndsWith("`r`n0`r`n`r`n")) { break }
            }
        } while ($count)
        $raw = $memory.ToArray()
        $ascii = [Text.Encoding]::ASCII.GetString($raw)
        $split = $ascii.IndexOf("`r`n`r`n")
        if ($split -lt 0 -or $ascii -notmatch '^HTTP/1\.[01] (\d+)') { throw 'Invalid API response.' }
        $status = [int]$Matches[1]
        if ($status -lt 200 -or $status -ge 300) { throw "Mihomo API $Method $Path returned HTTP $status." }
        $offset = $split + 4
        if ($ascii.Substring(0, $split) -match '(?i)Transfer-Encoding:\s*chunked') {
            $decoded = New-Object System.IO.MemoryStream
            try {
                while ($true) {
                    $end = $ascii.IndexOf("`r`n", $offset)
                    if ($end -lt 0) { throw 'Invalid chunked API response.' }
                    $length = [Convert]::ToInt32($ascii.Substring($offset, $end - $offset).Split(';')[0], 16)
                    if ($length -eq 0) { break }
                    $offset = $end + 2
                    $decoded.Write($raw, $offset, $length)
                    $offset += $length + 2
                }
                return [Text.Encoding]::UTF8.GetString($decoded.ToArray())
            } finally { $decoded.Dispose() }
        }
        return [Text.Encoding]::UTF8.GetString($raw, $offset, $raw.Length - $offset)
    } finally { $pipe.Dispose(); $memory.Dispose() }
}

try {
    $yaml = Get-Content -LiteralPath (Join-Path $dataDir 'clash-verge.yaml') -Raw
    if ($yaml -notmatch '(?m)^external-controller-pipe:\s*(.+?)\s*$') { throw 'Clash named pipe not found. Start Clash Verge first.' }
    $pipePath = $Matches[1].Trim().Trim([char]39, [char]34)
    if (-not $pipePath.StartsWith('\\.\pipe\')) { throw 'Unsupported named pipe address.' }
    $livePipes = @([IO.Directory]::GetFiles('\\.\pipe\'))
    if ($livePipes -notcontains $pipePath) {
        # Verge service mode uses a different prefix from its generated YAML.
        $suffix = ($pipePath -split '-')[-1]
        $candidates = @($livePipes | Where-Object { $_ -like '*\verge-mihomo-*' -and $_.EndsWith('-' + $suffix) })
        if ($candidates.Count -ne 1) { throw 'Cannot identify one active Mihomo pipe. Start Clash Verge and retry.' }
        $pipePath = $candidates[0]
    }
    $script:pipeName = $pipePath.Substring(9)
    $script:secret = ''
    if ($yaml -match '(?m)^secret:\s*(.*?)\s*$') { $script:secret = $Matches[1].Trim().Trim([char]39, [char]34) }
    $config = Invoke-Core GET '/configs' | ConvertFrom-Json
    Write-Host '当前网卡与 DNS：'
    Get-NetAdapter | Select-Object Name, InterfaceDescription, Status | Format-Table -AutoSize
    Get-DnsClientServerAddress | Where-Object { $_.ServerAddresses.Count } |
        Select-Object InterfaceAlias, AddressFamily, ServerAddresses | Format-Table -AutoSize
    $config.tun | Add-Member -NotePropertyName 'strict-route' -NotePropertyValue ([bool]$config.tun.'strict-route') -Force
    Write-Host "TUN enabled=$($config.tun.enable), strict-route=$($config.tun.'strict-route')"
    if (-not $DiagnoseOnly) {
        if ($Restore) {
            $backup = Get-ChildItem -LiteralPath $logDir -Filter '*-tun.json' | Sort-Object Name -Descending | Select-Object -First 1
            if (-not $backup) { throw 'No saved TUN state to restore.' }
            $tun = Get-Content -LiteralPath $backup.FullName -Raw | ConvertFrom-Json
        } else {
            if (-not $config.tun.enable) { throw 'TUN is disabled. Enable it in Clash Verge first; no settings were changed.' }
            $config.tun | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $logDir "$stamp-tun.json") -Encoding UTF8
            $tun = @{ enable = $true; 'strict-route' = $true; 'auto-route' = $true; 'auto-detect-interface' = $true;
                'dns-hijack' = @('any:53', 'tcp://any:53') }
        }
        Write-Host '正在应用 TUN 路由，网络可能短暂重连……'
        $null = Invoke-Core PATCH '/configs' (@{ tun = $tun } | ConvertTo-Json -Depth 20 -Compress)
        $after = Invoke-Core GET '/configs' | ConvertFrom-Json
        if ($Restore) {
            if ($after.tun.enable -ne $tun.enable -or [bool]$after.tun.'strict-route' -ne [bool]$tun.'strict-route') { throw 'TUN restore verification failed.' }
        } elseif (-not $after.tun.enable -or -not $after.tun.'strict-route' -or
            -not $after.tun.'auto-route' -or -not $after.tun.'auto-detect-interface' -or
            $after.tun.'dns-hijack' -notcontains 'tcp://any:53') { throw 'TUN settings verification failed.' }
        $null = Invoke-Core POST '/cache/dns/flush'
        Clear-DnsClientCache
        Write-Host "已完成并验证：strict-route=$($after.tun.'strict-route')；Windows/Mihomo DNS 缓存已清理。"
        Write-Host '设置已生效；是否仍有外部 DNS 泄漏，需要关闭旧测试页并重新运行 Extended Test。'
        Write-Host 'https://www.dnsleaktest.com/  |  https://ipleak.net/'
        Write-Host 'Clash 重启或重新应用配置后可能覆盖运行设置；切换网络后再次运行本脚本。'
    }
} catch {
    $exitCode = 1
    Write-Host "处理失败：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host '请查看日志；当前不能确认 DNS 泄漏已修复。'
} finally {
    Write-Host "日志：$log"
    Stop-Transcript | Out-Null
    if (-not $NoPause) { Read-Host '按回车关闭' | Out-Null }
}
exit $exitCode
