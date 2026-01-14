# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Combine schema files (generated file, not in git)
RUN node scripts/combine-schemas.js

# Generate Prisma Client
RUN npx prisma generate --schema=./prisma/combined-schema.prisma

# Build Next.js app (standalone output for smaller image)
ENV NEXT_TELEMETRY_DISABLED=1
# Provide dummy env vars for build (actual values come from AWS SSM at runtime)
ENV NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key
ENV SUPABASE_SERVICE_ROLE_KEY=dummy_service_key
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DIRECT_URL=postgresql://dummy:dummy@localhost:5432/dummy
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files and all dependencies for migrations
# Need full node_modules from builder for migration CLI to work
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/healthz || exit 1

CMD ["./docker-entrypoint.sh"]
