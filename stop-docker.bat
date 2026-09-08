@echo off
setlocal
cd /d "%~dp0"
docker compose -f infrastructure/docker-compose.yml down
pause
