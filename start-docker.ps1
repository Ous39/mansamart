Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".env.docker")) {
  Copy-Item ".env.docker.example" ".env.docker"
  Write-Host "Created .env.docker from .env.docker.example"
  Write-Host "For phone testing, edit .env.docker and set LAN_IP to your computer Wi-Fi IPv4 address."
}

docker compose --env-file .env.docker -f infrastructure/docker-compose.yml up --build
