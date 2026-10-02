@echo off
title GitHub Login and Push
echo ======================================================================
echo           ONE-CLICK GITHUB AUTHENTICATION AND PUSH
echo ======================================================================
echo.
echo Step 1: Logging in via GitHub CLI (a browser window will open)...
echo.
"C:\Users\UMA MANIDEEP\AppData\Local\Programs\gh\gh.exe" auth login --web -h github.com -p https

echo.
echo Step 2: Configuring Git to use GitHub CLI credentials...
"C:\Users\UMA MANIDEEP\AppData\Local\Programs\gh\gh.exe" auth setup-git

echo.
echo Step 3: Pushing code to https://github.com/akuthotaumamanideep-star/WIFI-ACCESS-POINT.git ...
cd /d "C:\Users\UMA MANIDEEP\OneDrive\Desktop\WIFI SOPT DAA PROJECT"
"C:\Users\UMA MANIDEEP\AppData\Local\Programs\Git\cmd\git.exe" push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo ======================================================================
    echo   SUCCESSFULLY PUSHED TO GITHUB!
    echo   Repository: https://github.com/akuthotaumamanideep-star/WIFI-ACCESS-POINT
    echo ======================================================================
) else (
    echo [!] Push encountered an issue. Please check the error above.
)
echo.
pause
