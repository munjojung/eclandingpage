@echo off
setlocal
cd /d "%~dp0"
title English Community - One Click Security Test
echo ============================================================
echo  English Community - Admin Session Security Test
echo ============================================================
echo.
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 "%~dp0test_security.py"
    goto end
)
where python >nul 2>nul
if %errorlevel%==0 (
    python "%~dp0test_security.py"
    goto end
)
echo Python 3 was not found.
echo Install Python 3 from https://www.python.org/downloads/
echo Then run this file again.
pause
:end
endlocal
