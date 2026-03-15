# ─── SmileStudio Backend Dockerfile ──────────────────────
# Multi-stage build: development → production

# ─── Base ────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ─── Development ─────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate
EXPOSE 3000 5555
CMD ["npx", "tsx", "watch", "src/server.ts"]

# ─── Builder ─────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate
RUN npm run build

# ─── Production ──────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Copy built app and Prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node
EXPOSE 3000

# Use dumb-init for proper signal handling
CMD ["dumb-init", "node", "dist/server.js"]
