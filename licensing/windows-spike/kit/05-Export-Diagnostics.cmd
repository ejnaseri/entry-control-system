@echo off
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Export-Diagnostics.ps1"
if errorlevel 1 echo Export failed. Keep the error for review.
pause
