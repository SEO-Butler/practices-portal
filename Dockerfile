FROM node:20-alpine
WORKDIR /app

# Prisma on alpine needs openssl
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY . .

# prisma.config.ts resolves env("DATABASE_URL") at config-load time, so even
# `prisma generate` (which never connects) requires the var to be set. Supply a
# throwaway build-only value via ARG — it is NOT persisted into the runtime
# image. Coolify injects the real DATABASE_URL at runtime for `migrate deploy`.
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npm run build

EXPOSE 3000
# Apply migrations on boot, then start
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
