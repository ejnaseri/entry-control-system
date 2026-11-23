@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Manage-Spike.ps1" -Action Cleanup
if errorlevel 1 echo Incomplete. Keep output and resources for review.
pause
