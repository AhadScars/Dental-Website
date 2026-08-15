@echo off
cd /d "%~dp0"
echo Starting Elegancia site + Gmail SMTP mailer...
echo Open http://127.0.0.1:8787
echo.
python mail-server.py
if errorlevel 1 python3 mail-server.py
pause
