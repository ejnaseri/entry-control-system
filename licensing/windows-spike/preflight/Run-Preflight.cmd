@echo off
setlocal
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Collect-Preflight.ps1"
set "ecsPreflightExit=%ERRORLEVEL%"
if not "%ecsPreflightExit%"=="0" echo Preflight could not finish. Keep the error text for review.
echo.
pause
exit /b %ecsPreflightExit%
