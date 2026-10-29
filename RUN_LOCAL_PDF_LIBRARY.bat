@echo off
setlocal
cd /d "%~dp0"
echo Starting local PDF library at http://localhost:8000/local-pdf-library.html
echo Keep this window open while using the local PDF library.
start "" http://localhost:8000/local-pdf-library.html
py -m http.server 8000 --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo Python launcher 'py' was not found. Trying 'python'...
  python -m http.server 8000 --bind 127.0.0.1
)
pause
