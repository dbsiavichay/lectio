# syntax=docker/dockerfile:1
#
# Production image: the standalone Next.js server on Node 24 (Alpine), plus
# the database migrations and the command-line scripts (create users, import
# books, back up). The image holds no book content and no secrets: books are
# imported into the database at runtime, which lives in a mounted volume.
#
#   docker build --build-arg BUILD_SHA="$(git rev-parse HEAD)" -t lectio .
#
# Runtime configuration (APP_URL, RP_ID, TZ) comes from the environment and is
# validated by src/lib/env.ts when the server starts.

ARG NODE_IMAGE=node:24-alpine

# Dependencies alone, so a change to the code reuses this layer. The native
# addons (better-sqlite3, argon2) ship musl prebuilds; the toolchain is only a
# fallback for an architecture without one.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:scripts

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
# Docker sets HOSTNAME to the container ID, and server.js binds to HOSTNAME.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/app/data/lectio.db \
    MIGRATIONS_DIR=/app/migrations \
    TZ=America/Guayaquil

# Code owned by root, so the process cannot rewrite it. The server brings its
# traced node_modules (with the native addons the scripts also load).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/db/migrations ./migrations
COPY --from=builder /app/dist/scripts ./scripts

# The only places the app writes: Next's cache (a tmpfs in production) and the
# data directory (a bind mount holding the database and its backups).
RUN mkdir -p .next/cache data && chown node:node .next/cache data

ARG BUILD_SHA=dev
ENV BUILD_SHA=${BUILD_SHA}
LABEL org.opencontainers.image.title="lectio" \
      org.opencontainers.image.description="Lectio: estudio guiado de libros." \
      org.opencontainers.image.source="https://github.com/dbsiavichay/lectio" \
      org.opencontainers.image.revision="${BUILD_SHA}"

USER node
EXPOSE 3000

# busybox wget ships with Alpine. /healthz also checks the database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
