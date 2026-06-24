FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci

COPY . .

RUN mkdir -p /app/storage

EXPOSE 3000

CMD ["sh", "-c", "npm run seed:roles && npm run start:dev"]
