@echo off
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Manage-Spike.ps1" -Action Recheck
if errorlevel 1 echo Recheck did not finish. Keep the error and test files for review.
pause
