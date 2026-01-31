@echo off
REM ===========================
REM Git Push Automation Script
REM ===========================

REM Komut satırı rengini değiştir (isteğe bağlı)
color 0A

echo.
echo ===========================
echo Git Push Automation Script
echo ===========================
echo.

REM Mevcut branch'i göster
git branch

echo.
REM Commit mesajını sor
set /p commitmsg=Enter commit message: 

REM Tüm değişiklikleri ekle
git add .

REM Commit oluştur
git commit -m "%commitmsg%"

REM Push
git push origin main

echo.
echo ===========================
echo Push completed!
echo ===========================
pause