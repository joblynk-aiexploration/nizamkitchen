FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Provide build-time env so env.ts validation passes (runtime values injected at container start)
ENV NIZAMKITCHEN_SKIP_BUILD_DB=1
RUN cp .env.example .env
RUN npm run db:generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat openssl wget \
  && addgroup -S nodejs \
  && adduser -S nextjs -G nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/uploads \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
