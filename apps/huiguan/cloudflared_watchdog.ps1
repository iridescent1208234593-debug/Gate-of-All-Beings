# cloudflared 守护：进程不在就拉起
$exe = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$proc = Get-Process cloudflared -ErrorAction SilentlyContinue
if (-not $proc) {
  Start-Process -FilePath $exe -ArgumentList 'tunnel','run'
  "restarted" | Out-File -Append "$PSScriptRoot\cloudflared_watchdog.log"
}
