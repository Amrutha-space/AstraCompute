FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY backend/package.json backend/package.json
COPY core-engine/package.json core-engine/package.json
COPY frontend/package.json frontend/package.json
RUN npm install

COPY . .
RUN npm run build:core && npm run build:backend

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY backend/package.json backend/package.json
COPY core-engine/package.json core-engine/package.json
RUN npm install --omit=dev --workspace backend --workspace core-engine

COPY --from=builder /app/backend/dist backend/dist
COPY --from=builder /app/core-engine/dist core-engine/dist
COPY logs logs

WORKDIR /app/backend
CMD ["node", "dist/server.js"]
