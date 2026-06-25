# Folio Setup Guide

This guide describes the recommended local development setup for Folio / DocHub.

We only use Docker for infrastructure:

- **MongoDB:** Docker
- **Redis:** Docker
- **Backend:** local terminal / IDE
- **Frontend:** local terminal / IDE

This setup is simpler than running the whole app in Docker. It avoids Docker path issues, keeps Vite hot reload fast, and makes Apryse WebViewer easier to debug.

## 1. Project structure

Keep the backend and frontend repositories as sibling folders:

```txt
DocHubTest/
  DocHubBE/
    docker-compose.yml
    .env
  DocHubFE/
    .env
    package.json
```

Example local storage folder:

```txt
DocHubTest/
  storage/
```

## 2. Start MongoDB and Redis with Docker

Go to the backend repository:

```bash
cd DocHubBE
```

Start infrastructure services:

```bash
docker compose up -d
```

The compose file should expose:

```txt
MongoDB: localhost:27017
Redis:   localhost:6380
```

The backend is not required to run inside Docker in this setup.

A minimal `docker-compose.yml` is:

```yaml
services:
  mongodb:
    image: mongo:7
    container_name: dochub-mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: dochub-redis
    ports:
      - "6380:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  mongodb_data:
  redis_data:
```

To stop services:

```bash
docker compose down
```

To reset MongoDB and Redis completely:

```bash
docker compose down -v
```

Warning: `down -v` deletes Docker volume data.

## 3. Backend local setup

Go to the backend repository:

```bash
cd DocHubBE
npm install
```

Create or paste the backend `.env` file.

Because the backend runs locally, use `localhost` for MongoDB and Redis:

```env
NODE_ENV=development
PORT=3000

MONGO_URL=mongodb://localhost:27017/dochub
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_URL=redis://localhost:6380

APP_URL=http://localhost:3000
APP_CLIENT_URL=http://localhost:5173

LOCAL_STORAGE_ROOT=E:/DocHubTest/storage
```

Important:

```env
MONGO_URL=mongodb://mongodb:27017/dochub
REDIS_HOST=redis
LOCAL_STORAGE_ROOT=/app/storage
```

are Docker-container values. Do not use them when running the backend locally from the IDE or terminal.

Start the backend:

```bash
npm run start:dev
```

The backend should run at:

```txt
http://localhost:3000
```

## 4. Frontend local setup

Go to the frontend repository:

```bash
cd DocHubFE
npm install
```

Create or paste the frontend `.env` file:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
VITE_APRYSE_LICENSE_KEY=your_apryse_license_key_or_blank_for_demo
```

Copy Apryse WebViewer static assets:

```bash
npm run copy:webviewer
```

This command should create:

```txt
public/webviewer/lib
```

and copy files from:

```txt
node_modules/@pdftron/webviewer/public
```

Then start the frontend:

```bash
npm run dev
```

Open:

```txt
http://localhost:5173
```

## 5. Daily development flow

Terminal 1, infrastructure:

```bash
cd DocHubBE
docker compose up -d
```

Terminal 2, backend:

```bash
cd DocHubBE
npm run start:dev
```

Terminal 3, frontend:

```bash
cd DocHubFE
npm run copy:webviewer
npm run dev
```

Use the app at:

```txt
http://localhost:5173
```

## 6. Verify the setup

Check backend health by opening an API route or logging in from the frontend.

After uploading a PDF, the document detail API should return `200`:

```txt
GET http://localhost:3000/api/workspaces/:workspaceId/documents/:documentId
```

The returned `pdfFileUrl` should look like:

```txt
http://localhost:3000/storage/documents/:workspaceId/:documentId.pdf
```

Verify the PDF URL:

```bash
curl -I "http://localhost:3000/storage/documents/:workspaceId/:documentId.pdf"
```

Expected result:

```txt
HTTP/1.1 200 OK
Content-Type: application/pdf
```

## 7. Apryse / Vite cache note

When developing the PDF viewer, open Chrome DevTools and enable:

```txt
Network tab -> Disable cache
```

Keep DevTools open while testing the viewer.

If you see errors like:

```txt
GET /webviewer/lib/@vite/client 404
GET /webviewer/lib/src/main.jsx 404
```

try this first:

1. enable **Disable cache** in the Network tab;
2. hard reload with `Ctrl + Shift + R`;
3. verify this URL returns Apryse WebViewer UI HTML:

```txt
http://localhost:5173/webviewer/lib/ui/index.html
```

These errors usually mean the browser cached an old Vite fallback response before WebViewer assets were copied correctly. They are usually not caused by the backend.

## 8. Common mistakes

### Using Docker hostnames in local backend

If the backend shows:

```txt
getaddrinfo ENOTFOUND mongodb
```

then `.env` is probably using:

```env
MONGO_URL=mongodb://mongodb:27017/dochub
```

For local backend, use:

```env
MONGO_URL=mongodb://localhost:27017/dochub
```

### Using Docker Redis port locally

Inside Docker, Redis uses port `6379`.

From local backend, use the exposed host port:

```env
REDIS_HOST=localhost
REDIS_PORT=6380
```

### Forgetting to copy WebViewer assets

If Apryse cannot load its UI, run:

```bash
cd DocHubFE
npm run copy:webviewer
```

Then hard reload the browser.
