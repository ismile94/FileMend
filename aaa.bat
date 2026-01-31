@echo off
:: Proje klasörüne git
cd /d C:\Users\Ismail\Desktop\app

echo --- Git Push Islemi Basliyor ---

:: Dosyaları ekle
git add .

:: Kullanıcıdan commit mesajı iste (boş bırakılırsa varsayılan mesajı kullanır)
set /p msg="Commit mesajini girin (VARSAYILAN: Guncelleme): "
if "%msg%"=="" set msg=Guncelleme

:: Commit yap
git commit -m "%msg%"

:: Push yap (Force push istersen sonuna --force ekleyebilirsin ama normal kullanımda gerek yok)
git push origin main

echo --- Islem Tamamlandi! ---
pause