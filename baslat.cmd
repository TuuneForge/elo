@echo off
cd /d "%~dp0"
title MandiraPro Baslatici
echo.
echo   MandiraPro baslatiliyor...
echo   Yerel sunucu: http://127.0.0.1:8090
echo.

netstat -ano | findstr ":8090" | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo   Sunucu zaten calisiyor, tarayici aciliyor...
  start "" "http://127.0.0.1:8090/"
  timeout /t 3 >nul
  exit /b
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "MandiraPro Sunucu" cmd /c "py -m http.server 8090 --bind 127.0.0.1"
) else (
  start "MandiraPro Sunucu" cmd /c "python -m http.server 8090 --bind 127.0.0.1"
)

timeout /t 2 >nul
start "" "http://127.0.0.1:8090/"

echo   Tarayici acildi. Sunucu ayri pencerede calisiyor.
echo   Sunucuyu kapatmak icin "MandiraPro Sunucu" penceresini kapatin.
echo.
timeout /t 5 >nul
