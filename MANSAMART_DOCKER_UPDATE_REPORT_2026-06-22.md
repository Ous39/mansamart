# MansaMart Docker Update Report — 2026-06-22

## Goal

Make MansaMart easier and faster to run by adding Docker support for the database, backend API, and Expo frontend.

## Added files

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `.env.docker.example`
- `DOCKER_README.md`
- `docker/api-start.sh`
- `docker/expo-start.sh`
- `docker/wait-for-postgres.sh`
- `start-docker.bat`
- `stop-docker.bat`
- `start-docker.ps1`

## Updated files

- `README.md`
  - Added Docker quick-start instructions.
- `package.json`
  - Added convenience scripts:
    - `npm run docker:up`
    - `npm run docker:down`
    - `npm run docker:reset`
    - `npm run docker:logs`

## What Docker now runs

- PostgreSQL database container
- Express backend API container
- Expo frontend development container

## Main command

```bash
docker compose up --build
```

Or on Windows, double-click:

```text
start-docker.bat
```

## Browser URLs

```text
http://localhost:8081
http://localhost:5000/api/health
```

## Important note for phone testing

For Expo Go on a real phone, copy `.env.docker.example` to `.env.docker`, set `LAN_IP` to the laptop Wi-Fi IPv4 address, then run:

```bash
docker compose --env-file .env.docker up --build
```

If the phone cannot connect on LAN, set:

```env
EXPO_TUNNEL=true
```

in `.env.docker` and restart Docker.
