@echo off
echo ========================================================
echo  Pushing Wi-Fi AP Placement Project to GitHub...
echo ========================================================
cd /d "%~dp0"

echo Current Status:
"C:\Users\UMA MANIDEEP\AppData\Local\Programs\Git\cmd\git.exe" status

echo.
echo Pushing branch 'main' to origin...
"C:\Users\UMA MANIDEEP\AppData\Local\Programs\Git\cmd\git.exe" push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo  SUCCESS! Code pushed to:
    echo  https://github.com/akuthotaumamanideep-star/WIFI-ACCESS-POINT
    echo ========================================================
) else (
    echo.
    echo If prompted to authenticate, please complete sign-in in your browser window.
)
pause
