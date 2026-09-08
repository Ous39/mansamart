FROM node:20-bookworm-slim
WORKDIR /workspace
ENV CI=1 PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git python3 make g++ postgresql-client \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/customer-mobile/package.json apps/customer-mobile/package.json
COPY apps/business-mobile/package.json apps/business-mobile/package.json
COPY apps/rider-mobile/package.json apps/rider-mobile/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/authentication/package.json packages/authentication/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/business-logic/package.json packages/business-logic/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN chmod +x infrastructure/docker/*.sh
EXPOSE 5000 4173 4174 8081 8082 8083
CMD ["pnpm", "dev:api"]
