# MansaMart Docker guide

The monorepo has one Docker Compose configuration at `infrastructure/docker-compose.yml`.

## Start everything

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker -f infrastructure/docker-compose.yml up --build
```

On Windows you can run `start-docker.bat` or `start-docker.ps1`.

The stack starts PostgreSQL, the API, three Expo development servers, the marketplace website, and the administrator website. Set `LAN_IP` in `.env.docker` to the computer's Wi-Fi IPv4 address before opening an Expo QR code on a physical phone.

## Services

| Service | Port |
|---|---:|
| PostgreSQL | 5432 |
| API | 5000 |
| Customer mobile | 8081 |
| Business mobile | 8082 |
| Rider mobile | 8083 |
| Marketplace web | 4173 |
| Administrator web | 4174 |

## Stop

```bash
docker compose -f infrastructure/docker-compose.yml down
```

The PostgreSQL and upload volumes are preserved. Add `-v` only when you intentionally want to remove local Docker data.
