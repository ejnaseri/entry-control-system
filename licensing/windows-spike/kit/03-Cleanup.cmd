@echo off
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Manage-Spike.ps1" -Action Cleanup
if errorlevel 1 echo Cleanup incomplete. Keep the error and resources for review.
pause
