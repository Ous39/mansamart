@echo off
setlocal EnableExtensions
title MansaMart Business App
cd /d "%~dp0"

set "COMPOSE_FILE=infrastructure\docker-compose.yml"
set "ENV_FILE=.env.docker"
if not exist "%ENV_FILE%" set "ENV_FILE=.env.docker.example"

echo.
echo =====================================================
echo             MansaMart Business Launcher
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
  echo ERROR: Install Docker Desktop and try again.
  echo https://www.docker.com/products/docker-desktop/
  exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
  echo ERROR: Open Docker Desktop, wait until it is ready, and try again.
  exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Install Node.js 20 or later.
  echo https://nodejs.org/
  exit /b 1
)
for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 20 (
  echo ERROR: Node.js 20 or later is required. Found %NODE_MAJOR%.
  exit /b 1
)
where corepack >nul 2>&1
if not errorlevel 1 (
  set "PNPM_CMD=corepack pnpm"
) else (
  where pnpm >nul 2>&1
  if errorlevel 1 (
    echo ERROR: Run npm install --global pnpm@11.19.0 first.
    exit /b 1
  )
  set "PNPM_CMD=pnpm"
)
exit /b 0

:prepare_project
call :check_requirements
if errorlevel 1 exit /b 1
echo.
echo Checking project dependencies...
call %PNPM_CMD% install --frozen-lockfile
if errorlevel 1 exit /b 1
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" stop business-mobile >nul 2>&1
echo.
echo Starting PostgreSQL and the MansaMart API...
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" up -d --build postgres api
if errorlevel 1 exit /b 1
echo Waiting for http://localhost:5000/api/health ...
for /L %%I in (1,1,60) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:5000/api/health'; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 goto :api_ready
  timeout /t 2 /nobreak >nul
)
echo ERROR: The API did not become ready.
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" logs --tail=80 postgres api
exit /b 1

:api_ready
echo API is ready.
exit /b 0

:run_phone
set "LAN_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$ip = Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } ^| ForEach-Object { $_.IPv4Address.IPAddress } ^| Where-Object { $_ -and $_ -notlike '169.254.*' } ^| Select-Object -First 1; if ($ip) { $ip }"`) do set "LAN_IP=%%I"
if not defined LAN_IP set "LAN_IP=localhost"
echo Detected computer IP: %LAN_IP%
set "CUSTOM_IP="
set /p "CUSTOM_IP=Press Enter to use it, or type the correct Wi-Fi IPv4 address: "
if defined CUSTOM_IP set "LAN_IP=%CUSTOM_IP%"
call :prepare_project
if errorlevel 1 goto :failed
set "EXPO_PUBLIC_APP_AUDIENCE=business"
set "EXPO_PUBLIC_API_URL=http://%LAN_IP%:5000"
echo.
echo Install Expo Go, keep both devices on the same Wi-Fi, and scan the QR code.
echo Press Ctrl+C to stop Expo.
call %PNPM_CMD% --filter @mansamart/business-mobile exec expo start --host lan --port 8082 --clear
goto :end

:run_web
call :prepare_project
if errorlevel 1 goto :failed
set "EXPO_PUBLIC_APP_AUDIENCE=business"
set "EXPO_PUBLIC_API_URL=http://127.0.0.1:5000"
echo Opening http://localhost:8082 ...
start "" "http://localhost:8082"
call %PNPM_CMD% --filter @mansamart/business-mobile exec expo start --web --port 8082 --clear
goto :end

:stop_services
where docker >nul 2>&1
if errorlevel 1 goto :failed
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" down
if errorlevel 1 goto :failed
echo Services stopped. Database data was preserved.
pause
goto :end

:failed
echo.
echo MansaMart Business did not start. Read the error above, then try again.
pause
exit /b 1

:end
endlocal
exit /b 0
