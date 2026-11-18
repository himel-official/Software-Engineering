@echo off
echo Stopping CrimeMap servers...
taskkill /FI "WINDOWTITLE eq CrimeMap Backend*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq CrimeMap Frontend*" /T /F >nul 2>nul
echo Stopped.
timeout /t 2 >nul
