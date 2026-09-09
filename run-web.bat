@echo off
setlocal EnableExtensions
title MansaMart Website
cd /d "%~dp0"

set "COMPOSE_FILE=infrastructure\docker-compose.yml"
set "ENV_FILE=.env.docker"
if not exist "%ENV_FILE%" set "ENV_FILE=.env.docker.example"

echo.
echo =====================================================
echo               MansaMart Web Launcher
echo =====================================================
echo.
echo  1. Run the website
echo  2. Stop the local database and API
echo  3. Exit
echo.
choice /C 123 /N /M "Choose 1, 2, or 3: "
if errorlevel 3 goto :end
if errorlevel 2 goto :stop_services
if errorlevel 1 goto :run_web

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
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" stop web >nul 2>&1
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

:run_web
call :prepare_project
if errorlevel 1 goto :failed
set "VITE_API_URL=http://127.0.0.1:5000"
echo.
echo Opening http://localhost:4173 ...
echo Press Ctrl+C to stop the website.
start "" "http://localhost:4173"
call %PNPM_CMD% --filter @mansamart/web dev
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
echo MansaMart Web did not start. Read the error above, then try again.
pause
exit /b 1

:end
endlocal
exit /b 0
