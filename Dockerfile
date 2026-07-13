# ============================================================================
# CALIRAL INSIGHT - Dockerfile multi-stage para producción
# Build optimizado con Bun + Next.js standalone
# ============================================================================

# --- Stage 1: Dependencies ---
FROM oven/bun:1.1 AS deps
WORKDIR /app

# Copiar solo archivos de dependencias para cache
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- Stage 2: Build ---
FROM oven/bun:1.1 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generar cliente de Prisma
RUN bun run db:generate

# Build de Next.js (modo standalone)
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# --- Stage 3: Runner (producción) ---
FROM oven/bun:1.1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copiar archivos necesarios
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar schema de Prisma y migraciones
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Crear directorio para DB SQLite si se usa
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV DATABASE_URL="file:/app/data/caliral.db"

# Script de inicio: aplica schema y arranca servidor
CMD ["sh", "-c", "bunx prisma db push --skip-generate && node server.js"]
