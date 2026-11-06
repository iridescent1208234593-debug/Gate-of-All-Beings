@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\lab.ps1" restore %*
if not "%NOPAUSE%"=="1" pause
