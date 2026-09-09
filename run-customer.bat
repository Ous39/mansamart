@echo off
setlocal EnableExtensions
title MansaMart Customer App

cd /d "%~dp0"

set "COMPOSE_FILE=infrastructure\docker-compose.yml"
set "ENV_FILE=.env.docker"
if not exist "%ENV_FILE%" set "ENV_FILE=.env.docker.example"

echo.
echo =====================================================
echo            MansaMart Customer App Launcher
echo =====================================================
echo.
echo  1. Run on a phone with Expo Go
echo  2. Run in a web browser
echo  3. Stop the local database and API
echo  4. Exit
echo.
choice /C 1234 /N /M "Choose 1, 2, 3, or 4: "

if errorlevel 4 goto :end
if errorlevel 3 goto :stop_services
if errorlevel 2 goto :run_web
if errorlevel 1 goto :run_phone

:check_requirements
where docker >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Docker Desktop is not installed or Docker is not in PATH.
  echo Install Docker Desktop, open it, and run this file again.
  echo https://www.docker.com/products/docker-desktop/
  goto :failed
)

docker info >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Docker Desktop is installed but is not running.
  echo Open Docker Desktop, wait until it is ready, and try again.
  goto :failed
)

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Node.js 20 or later is required.
  echo Install the Node.js LTS release and run this file again.
  echo https://nodejs.org/
  goto :failed
)

for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 20 (
  echo.
  echo ERROR: Node.js 20 or later is required. Found Node.js %NODE_MAJOR%.
  goto :failed
)

where corepack >nul 2>&1
if not errorlevel 1 (
  set "PNPM_CMD=corepack pnpm"
) else (
  where pnpm >nul 2>&1
  if errorlevel 1 (
    echo.
    echo ERROR: pnpm is missing and Corepack is unavailable.
    echo Run: npm install --global pnpm@11.19.0
    goto :failed
  )
  set "PNPM_CMD=pnpm"
)

if not exist "package.json" (
  echo.
  echo ERROR: Run this file from the MansaMart repository root.
  goto :failed
)

exit /b 0

:prepare_project
call :check_requirements
if errorlevel 1 exit /b 1

echo.
echo Checking project dependencies...
call %PNPM_CMD% install --frozen-lockfile
if errorlevel 1 (
  echo.
  echo ERROR: Project dependencies could not be installed.
  exit /b 1
)

docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" stop customer-mobile >nul 2>&1

echo.
echo Starting PostgreSQL and the MansaMart API...
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" up -d --build postgres api
if errorlevel 1 (
  echo.
  echo ERROR: Docker could not start PostgreSQL and the API.
  echo Run run-customer.bat again and choose option 3 before retrying.
  exit /b 1
)

echo Waiting for the API at http://localhost:5000/api/health ...
for /L %%I in (1,1,60) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:5000/api/health'; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 goto :api_ready
  timeout /t 2 /nobreak >nul
)

echo.
echo ERROR: The API did not become ready.
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" logs --tail=80 postgres api
exit /b 1

:api_ready
echo API is ready.
exit /b 0

:run_phone
call :prepare_project
if errorlevel 1 goto :failed

set "LAN_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$ip = Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } ^| ForEach-Object { $_.IPv4Address.IPAddress } ^| Where-Object { $_ -and $_ -notlike '169.254.*' } ^| Select-Object -First 1; if ($ip) { $ip }"`) do set "LAN_IP=%%I"

if not defined LAN_IP set "LAN_IP=localhost"
echo.
echo Detected computer IP: %LAN_IP%
set "CUSTOM_IP="
set /p "CUSTOM_IP=Press Enter to use it, or type the correct Wi-Fi IPv4 address: "
if defined CUSTOM_IP set "LAN_IP=%CUSTOM_IP%"

set "EXPO_PUBLIC_APP_AUDIENCE=customer"
set "EXPO_PUBLIC_API_URL=http://%LAN_IP%:5000"

echo.
echo API used by the phone: %EXPO_PUBLIC_API_URL%
echo Make sure the phone and computer use the same Wi-Fi.
echo Open Expo Go and scan the QR code that appears below.
echo Press Ctrl+C when you want to stop the Expo server.
echo.
call %PNPM_CMD% --filter @mansamart/customer-mobile exec expo start --host lan --port 8081 --clear
goto :end

:run_web
call :prepare_project
if errorlevel 1 goto :failed

set "EXPO_PUBLIC_APP_AUDIENCE=customer"
set "EXPO_PUBLIC_API_URL=http://127.0.0.1:5000"

echo.
echo Opening the Customer app at http://localhost:8081 ...
echo Press Ctrl+C when you want to stop the Expo server.
echo.
start "" "http://localhost:8081"
call %PNPM_CMD% --filter @mansamart/customer-mobile exec expo start --web --port 8081 --clear
goto :end

:stop_services
where docker >nul 2>&1
if errorlevel 1 (
  echo.
  echo Docker was not found. There are no Docker services to stop here.
  goto :failed
)
echo.
echo Stopping the local MansaMart containers...
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" down
if errorlevel 1 goto :failed
echo Services stopped. Database data was preserved.
goto :success

:failed
echo.
echo MansaMart did not start. Read the error above, then try again.
pause
exit /b 1

:success
echo.
pause
exit /b 0

:end
endlocal
exit /b 0
