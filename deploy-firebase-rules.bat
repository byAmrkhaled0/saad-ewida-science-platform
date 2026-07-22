@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ==============================================
echo   Saad Ewida Platform - Firebase Rules Deploy
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the LTS version from https://nodejs.org/
  pause
  exit /b 1
)

echo [1/3] Checking the project files...
node scripts\verify.js
if errorlevel 1 (
  echo.
  echo Verification failed. Nothing was deployed.
  pause
  exit /b 1
)

echo.
echo [2/3] Firebase login will open in your browser.
echo Sign in with the Google account that owns saad-ewida-science-platform.
call npx --yes firebase-tools@latest login
if errorlevel 1 (
  echo.
  echo Firebase login failed. Nothing was deployed.
  pause
  exit /b 1
)

echo.
echo [3/3] Deploying Firestore rules, indexes, and Storage rules only...
call npx --yes firebase-tools@latest deploy --project saad-ewida-science-platform --only "firestore:rules,firestore:indexes,storage"
if errorlevel 1 (
  echo.
  echo Deployment failed. Read the error above; existing data was not deleted.
  pause
  exit /b 1
)

echo.
echo ==============================================
echo Rules deployed successfully. No student data was changed.
echo ==============================================
pause
endlocal
