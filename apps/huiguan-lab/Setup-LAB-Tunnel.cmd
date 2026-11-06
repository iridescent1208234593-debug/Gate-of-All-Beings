@echo off
rem Creates the LAB-only tunnel zszm-lab-v2 and the DNS record pc-lab.iridescently.cn (nothing else), then restarts the LAB.
cd /d "%~dp0server"
.venv\Scripts\python.exe -B ..\scripts\cloudflare_lab.py setup
if errorlevel 1 goto :end
set NOPAUSE=1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\lab.ps1" restart
:end
pause
