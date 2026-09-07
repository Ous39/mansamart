# MansaMart Docker Setup

This Docker setup is the easiest way to run MansaMart without installing PostgreSQL locally. It starts:

- PostgreSQL database
- Express backend API on port `5000`
- Expo frontend dev server on port `8081`

## 1. Install Docker

Install Docker Desktop on Windows or Mac. On Linux, install Docker Engine and Docker Compose.

## 2. Open the project folder

Unzip the project, then open a terminal in the `mansamart` folder.

## 3. Optional phone setup

For browser testing, you can skip this step.

For Expo Go on a real phone, copy the Docker env example:

```bash
cp .env.docker.example .env.docker
```

On Windows PowerShell:

```powershell
copy .env.docker.example .env.docker
```

Edit `.env.docker` and replace:

```env
LAN_IP=localhost
```

with your computer Wi-Fi IP address, for example:

```env
LAN_IP=192.168.1.20
```

On Windows, run this to find your IP:

```powershell
ipconfig
```

Look for the IPv4 address under your Wi-Fi adapter.

## 4. Start everything

Browser-only quick start:

```bash
docker compose up --build
```

Using `.env.docker`:

```bash
docker compose --env-file .env.docker up --build
```

The first run can take longer because Docker installs the Node dependencies inside the container.


## Windows one-click scripts

You can also start Docker on Windows by double-clicking:

```text
start-docker.bat
```

To stop the containers, double-click:

```text
stop-docker.bat
```

PowerShell option:

```powershell
./start-docker.ps1
```

## 5. Open the app

Backend health check:

```text
http://localhost:5000/api/health
```

Expo web app:

```text
http://localhost:8081
```

If Expo shows its terminal menu, press `w` inside the Expo container logs/terminal to open web mode, or open the URL above in your browser.

## 6. Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@oceanbrown.studio | admin123 |
| Vendor | vendor@oceanbrown.studio | vendor123 |
| Service Provider | provider@oceanbrown.studio | provider123 |
| Delivery Rider | rider@oceanbrown.studio | rider123 |
| Customer/User | user@oceanbrown.studio | user123 |

Some screens may also reference the newer `@mansamart.studio` demo emails from previous notes, but the current seed file creates the accounts above.

## 7. Useful Docker commands

Stop containers:

```bash
docker compose down
```

Stop containers and delete the database data:

```bash
docker compose down -v
```

Rebuild after dependency changes:

```bash
docker compose build --no-cache
```

View API logs only:

```bash
docker compose logs -f api
```

View Expo logs only:

```bash
docker compose logs -f expo
```

Run typecheck inside Docker:

```bash
docker compose run --rm api npm run typecheck
```

## 8. Phone not connecting?

Make sure your phone and laptop are on the same Wi-Fi, and set `LAN_IP` in `.env.docker` to your laptop IP.

If LAN still fails, enable tunnel mode in `.env.docker`:

```env
EXPO_TUNNEL=true
```

Then restart:

```bash
docker compose --env-file .env.docker up --build
```

Tunnel mode is often easier for phones, but it is slower than LAN mode.

## 9. Production note

This Docker setup is for local development and testing. Before production, change secrets, use a managed PostgreSQL or protected database volume, configure HTTPS, set a real domain, and disable demo seeding.
