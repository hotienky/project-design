# syntax=docker/dockerfile:1

# Next.js standalone build: the runtime stage runs `.next/standalone/server.js`
# instead of `next start`, so the final image carries no full node_modules.
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# git does not track empty directories; make sure the runtime COPY resolves.
RUN mkdir -p public && npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

# The standalone server does not copy `public` or `.next/static` itself.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Read at start-up by the migration runner (src/server/db/migrate.ts); file
# tracing only follows imports, so the SQL is not in the standalone output.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000

# Run the server as PID 1 so SIGTERM reaches it directly.
CMD ["node", "server.js"]
