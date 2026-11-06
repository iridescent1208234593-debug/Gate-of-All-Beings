$ErrorActionPreference = 'Stop'
# Builds the Godot web client into build/web (single-threaded Compatibility export: no
# SharedArrayBuffer, so no COOP/COEP requirement; works through the plain Cloudflare Tunnel).
$Lab = Split-Path -Parent $PSScriptRoot
$Client = Join-Path $Lab 'client'
$Out = Join-Path $Lab 'build\web'
$Godot = if ($env:LAB_GODOT) { $env:LAB_GODOT } else { Join-Path (Split-Path -Parent $Lab) 'Godot\Godot_v4.7.2-stable_win64.exe' }
if (!(Test-Path $Godot)) { throw "Godot 4.7.2 not found at $Godot (set LAB_GODOT)" }
if (Test-Path $Out) { Remove-Item -Recurse -Force $Out }
New-Item -ItemType Directory -Force $Out | Out-Null
$log = Join-Path $Lab 'build\export.log'
$p = Start-Process -FilePath $Godot -ArgumentList @('--headless', '--path', $Client, '--export-release', 'Web', (Join-Path $Out 'index.html')) -PassThru -Wait -NoNewWindow -RedirectStandardOutput $log -RedirectStandardError ($log + '.err')
$errors = Select-String -Path $log, ($log + '.err') -Pattern 'SCRIPT ERROR|^ERROR' -ErrorAction SilentlyContinue
if ($p.ExitCode -ne 0 -or !(Test-Path (Join-Path $Out 'index.pck')) -or $errors) { $errors | Select-Object -First 20; throw "Web export failed (exit $($p.ExitCode)); see $log" }
Copy-Item (Join-Path $Lab 'web\play\lab-bridge.js') $Out
# Pre-compress the large files once so the gateway never compresses per request.
& (Join-Path $Lab 'server\.venv\Scripts\python.exe') -c "import brotli,gzip,sys,pathlib; d=pathlib.Path(sys.argv[1]); [ (p.with_name(p.name+'.br').write_bytes(brotli.compress(p.read_bytes(), quality=9)), p.with_name(p.name+'.gz').write_bytes(gzip.compress(p.read_bytes(), 9))) for p in d.iterdir() if p.suffix in ('.wasm','.pck','.js')]" $Out
$version = 'lab-client-2.0.0+' + (Get-Date -Format 'yyyyMMddHHmm')
$files = Get-ChildItem $Out -File | ForEach-Object { @{ name = $_.Name; bytes = $_.Length; sha256 = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower() } }
@{ version = $version; built_at = (Get-Date).ToUniversalTime().ToString('o'); godot = '4.7.2.stable'; files = $files } | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $Out 'build-info.json') -Encoding UTF8
Get-ChildItem $Out | Select-Object Name, @{ n = 'KB'; e = { [math]::Round($_.Length / 1KB) } } | Format-Table -AutoSize
Write-Host "Built $version"
