# ---------- Stage 1: install all deps & compile TypeScript ----------
FROM node:22-alpine AS build
WORKDIR /app

# bcrypt is a native module — needs a toolchain to compile on musl/alpine
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- Stage 2: production-only node_modules ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

# ---------- Stage 3: runtime ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Required env vars at runtime:
#   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, FRONTEND_URL
# Optional: APP_PORT (defaults to 3201)
EXPOSE 3201

USER node
CMD ["node", "dist/main"]
