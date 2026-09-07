@echo off
setlocal
cd /d "%~dp0"

if not exist .env.docker (
  copy .env.docker.example .env.docker >nul
  echo Created .env.docker from .env.docker.example
  echo For phone testing, edit .env.docker and set LAN_IP to your computer Wi-Fi IPv4 address.
)

docker compose --env-file .env.docker up --build
pause
