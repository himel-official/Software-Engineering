@echo off
title CrimeMap Launcher
cd /d "%~dp0"

echo ==========================================
echo   CrimeMap - one click start
echo ==========================================
echo.

REM ---- 1. Check Node.js (needs 22.5 or newer) ----
where node >nul 2>nul
if errorlevel 1 goto nonode
for /f "tokens=*" %%v in ('node -v') do echo Node.js found: %%v
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22||(a===22&&b>=5)?0:1)"
if errorlevel 1 goto oldnode
echo.

REM ---- 2. Install libraries first time only ----
if exist "backend\node_modules" goto backend_ok
echo Installing backend libraries, first time only. Please wait...
pushd backend
call npm install
if errorlevel 1 goto installfail
popd
:backend_ok

if exist "frontend\node_modules" goto frontend_ok
echo Installing frontend libraries, first time only. Please wait...
pushd frontend
call npm install
if errorlevel 1 goto installfail
popd
:frontend_ok

REM ---- 3. Create secret keys (first time only) ----
pushd backend
node scripts\setup-env.js
if errorlevel 1 goto setupfail

REM ---- 4. Create the first admin account if there is none ----
node scripts\create-admin.js --if-none
if errorlevel 1 goto setupfail
popd

REM ---- 5. Start both servers in their own windows ----
echo.
echo Starting backend on port 5000...
start "CrimeMap Backend" /D "%~dp0backend" cmd /k npm run dev

echo Starting frontend on port 5173...
start "CrimeMap Frontend" /D "%~dp0frontend" cmd /k npm run dev

echo Opening browser...
timeout /t 6 /nobreak >nul
start http://localhost:5173

echo.
echo Done. Your website is running at http://localhost:5173
echo To stop everything, run stop.bat or close the two server windows.
echo.
pause
exit /b 0

:nonode
echo ERROR: Node.js is not installed.
echo Opening the download page. Install the LTS version,
echo then run start.bat again.
start https://nodejs.org
pause
exit /b 1

:oldnode
echo ERROR: Your Node.js is too old. This project needs version 22.5 or newer.
echo Opening the download page. Install the LTS version,
echo then run start.bat again.
start https://nodejs.org
pause
exit /b 1

:installfail
echo.
echo ERROR: npm install failed. Check your internet connection
echo and read the message above. Then run start.bat again.
pause
exit /b 1

:setupfail
echo.
echo ERROR: setup failed. Read the message above, then run start.bat again.
pause
exit /b 1
