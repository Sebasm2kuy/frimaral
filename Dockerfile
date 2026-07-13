# ============================================================================
# CALIRAL INSIGHT - Dockerfile multi-stage para producción
# Build con Bun 1.3 + Next.js standalone
# ============================================================================

# --- Stage 1: Dependencies ---
FROM oven/bun:1.3 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- Stage 2: Build ---
FROM oven/bun:1.3 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generar cliente de Prisma
RUN bunx prisma generate

# Build de Next.js (modo standalone)
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# --- Stage 3: Runner (producción) ---
FROM oven/bun:1.3 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Instalar prisma CLI para migraciones en runtime
RUN bun add prisma @prisma/client

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copiar archivos standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar schema de Prisma y cliente
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Script de seed para inicialización opcional
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db.ts ./src/lib/db.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/modules ./src/modules

# Crear directorio para DB SQLite si se usa
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data /app/node_modules

USER nextjs

EXPOSE 3000

# Script de inicio: aplica schema y arranca servidor
CMD ["sh", "-c", "bunx prisma db push --skip-generate --accept-data-loss 2>/dev/null; node server.js"]
