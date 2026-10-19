# supervise-services.ps1
# Logon-task supervisor for the production services listed in website-manager.py:
# portal 8080, OAuth 5174, juling 5177, softie 4173.
# It only STARTS a service whose port has no listener; it never stops or restarts a running one.
# Usage: -Once   one pass, then exit      -DryRun   print what would start (no process is created)
#        -ForceAll  treat every port as free (only meaningful with -DryRun)
param([switch]$Once, [switch]$DryRun, [switch]$ForceAll)
$ErrorActionPreference = 'Continue'
if (Test-Path -LiteralPath 'E:\Projects\.releases\hk-production.json') {
    Write-Host 'Production runs independently in Hong Kong. Start local preview manually in Website Manager.'
    return
}

$Root    = 'E:\Projects'
$Pub     = Join-Path $Root '.releases\production\site'
$Logs    = Join-Path $Root 'ops\网站恢复\logs'
$Python  = Join-Path $env:USERPROFILE 'AppData\Local\Python\pythoncore-3.14-64\python.exe'
$Node    = 'C:\Program Files\nodejs\node.exe'
$Vite    = 'node_modules/vite/bin/vite.js'
$Interval = 20      # seconds between passes
$Retry    = 45      # minimum seconds between start attempts for one service
$Settle   = 40      # seconds to wait for the port after a start

$Services = @(
    @{ Key='portal'; Port=8080; Exe=$Python; Cwd=(Join-Path $Pub 'server'); Args=@('-u','portal_server.py')
       Env=@{ PYTHONUTF8='1'; IRIDESCENTLY_ENVIRONMENT='production'; IRIDESCENTLY_PROJECT_ROOT=$Root } },
    @{ Key='zszm-oauth'; Port=5174; Exe=$Python; Cwd=(Join-Path $Pub 'server\app\src\cards'); Args=@('-u','server.py')
       Env=@{ PYTHONUTF8='1'; IRIDESCENTLY_ENVIRONMENT='production'; IRIDESCENTLY_PROJECT_ROOT=$Root } },
    @{ Key='juling'; Port=5177; Exe=$Node; Cwd=(Join-Path $Root 'server\app\src\juling'); Args=@('server.js')
       Env=@{ PORT='5177'; HOST='127.0.0.1' } },
    @{ Key='softie'; Port=4173; Exe=$Node; Cwd=(Join-Path $Root 'server\app\src\softie-webgpu')
       Args=@($Vite,'preview','--host','127.0.0.1','--port','4173','--outDir',(Join-Path $Root 'server\app\modules\softie'))
       Env=@{} }
)

function Write-Log([string]$Message) {
    New-Item -ItemType Directory -Force -Path $Logs | Out-Null
    $line = '{0} {1}' -f (Get-Date -Format 'o'), $Message
    [IO.File]::AppendAllText((Join-Path $Logs 'supervisor.log'), $line + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    Write-Host $line
}

function Test-Listening([int]$Port) {
    if ($ForceAll) { return $false }
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Start-Service-Once($svc) {
    if (-not (Test-Path -LiteralPath $svc.Exe)) { Write-Log "$($svc.Key): missing executable $($svc.Exe)"; return $false }
    if (-not (Test-Path -LiteralPath $svc.Cwd)) { Write-Log "$($svc.Key): missing directory $($svc.Cwd)"; return $false }
    if ($DryRun) { Write-Log "$($svc.Key): DRY RUN would start in $($svc.Cwd): $($svc.Exe) $($svc.Args -join ' ')"; return $true }
    foreach ($name in $svc.Env.Keys) { Set-Item -Path "Env:$name" -Value $svc.Env[$name] }
    $out = Join-Path $Logs "$($svc.Key).out.log"
    $err = Join-Path $Logs "$($svc.Key).log"
    Start-Process -FilePath $svc.Exe -ArgumentList $svc.Args -WorkingDirectory $svc.Cwd -WindowStyle Hidden `
        -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null
    foreach ($name in $svc.Env.Keys) { Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue }
    for ($i = 0; $i -lt $Settle; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Listening $svc.Port) { Write-Log "$($svc.Key): started, port $($svc.Port) is listening"; return $true }
    }
    Write-Log "$($svc.Key): started but port $($svc.Port) did not open within ${Settle}s"
    return $false
}

# One supervisor per user session.
$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\Iridescently-Portal-Supervisor', [ref]$created)
if (-not $created -and -not $DryRun) { Write-Host 'Supervisor already running.'; return }

function Test-MainTunnel {
    if ($ForceAll) { return $false }
    $cfg = (Join-Path $env:USERPROFILE '.cloudflared\config.yml').ToLower()
    foreach ($p in Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue) {
        $c = "$($p.CommandLine)".ToLower()
        if ($c -match '\btunnel\b' -and $c -match '\brun\b' -and ($c.Contains($cfg) -or $c.Contains('tunnel run main'))) { return $true }
    }
    return $false
}

function Start-MainTunnel {
    # Same launcher the logon task uses; it also refuses to start a duplicate connector.
    $vbs = Join-Path $Root 'ops\网站恢复\run-cloudflared-hidden.vbs'
    if ($DryRun) { Write-Log "tunnel: DRY RUN would run wscript $vbs"; return }
    Start-Process -FilePath 'C:\Windows\System32\wscript.exe' -ArgumentList "`"$vbs`"" -WindowStyle Hidden | Out-Null
    Write-Log 'tunnel: main cloudflared was not running; launched run-cloudflared-hidden.vbs'
}

$lastTry = @{}
$lastTunnel = [datetime]::MinValue
Write-Log "supervisor started (once=$Once dryrun=$DryRun)"
do {
    foreach ($svc in $Services) {
        if (Test-Listening $svc.Port) { continue }
        $since = if ($lastTry.ContainsKey($svc.Key)) { ((Get-Date) - $lastTry[$svc.Key]).TotalSeconds } else { [double]::MaxValue }
        if ($since -lt $Retry) { continue }
        $lastTry[$svc.Key] = Get-Date
        Write-Log "$($svc.Key): port $($svc.Port) has no listener; starting"
        $null = Start-Service-Once $svc
    }
    if (-not (Test-MainTunnel) -and ((Get-Date) - $lastTunnel).TotalSeconds -ge $Retry) {
        $lastTunnel = Get-Date
        Start-MainTunnel
    }
    if (-not $Once) { Start-Sleep -Seconds $Interval }
} while (-not $Once)
