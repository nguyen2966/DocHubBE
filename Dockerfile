FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/storage

EXPOSE 3000

CMD ["sh", "-c", "npm run seed:roles && npm run start:dev"]
