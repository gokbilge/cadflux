# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 CadFlux contributors

FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY tools ./tools
COPY .npmrc* ./

RUN corepack enable
RUN pnpm install --frozen-lockfile
RUN pnpm build:cadflux

FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV CADFLUX_HOST=0.0.0.0
ENV CADFLUX_PORT=8080
ENV CADFLUX_DATA_DIR=/app/data
ENV CADFLUX_DATABASE_PATH=/app/data/database/cadflux.sqlite

RUN useradd --create-home --uid 10001 cadflux
RUN corepack enable

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/packages ./packages

RUN mkdir -p /app/data && chown -R cadflux:cadflux /app

USER cadflux
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/dist/apps/server/src/index.js", "serve"]
