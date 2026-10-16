# syntax=docker/dockerfile:1
# Build context: ./frontend (see docker-compose.yml).

FROM node:24-alpine AS deps
WORKDIR /app
# Install first so this layer is cached until the lockfile changes.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public origin of the app (not a secret). next.config.ts reads it at build time to allow Server Actions
# from that host, and standalone output freezes the config, so it must be known here, not only at runtime.
ARG APP_ORIGIN=""
RUN APP_ORIGIN="$APP_ORIGIN" npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Standalone output: a minimal server.js plus only the node_modules it traces.
# The build stage needs to run as root for the cache mounts; the runtime image does not.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.status===200?0:1),()=>process.exit(1))"

CMD ["node", "server.js"]
