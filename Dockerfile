# MansaMart Docker image for local development
# Runs the Express API or Expo dev server depending on docker-compose command.
FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development \
    CI=1 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    CHOKIDAR_USEPOLLING=true \
    WATCHPACK_POLLING=true

# Native packages are needed by some Node/Expo dependencies.
# postgresql-client gives us pg_isready for safe database startup.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    make \
    g++ \
    python3 \
    postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY patches ./patches

RUN npm ci

COPY . .

RUN chmod +x docker/*.sh

EXPOSE 5000 8081 19000 19001 19002

CMD ["npm", "run", "server:dev"]
