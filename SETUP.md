# Folio Setup Guide

This setup uses:

- **Backend + MongoDB + Redis:** Docker
- **Frontend:** local `npm run dev`

This is the recommended development setup because the backend needs MongoDB, Redis, local storage, and PDF-processing dependencies, while the Vite frontend is simpler and faster to run directly on the host machine.

## 1. Project structure

Keep the backend and frontend repositories as sibling folders:

```txt
DocHubTest/
  DocHubBE/
    docker-compose.yml
    Dockerfile
    .env
  DocHubFE/
    .env
    package.json
```

## 2. Backend setup with Docker

Go to the backend repository:

```bash
cd DocHubBE
```

Create `.env` from `.env.example` and make sure these values are correct for Docker:

```env
NODE_ENV=production
PORT=3000

MONGO_URL=mongodb://mongodb:27017/dochub
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379

APP_URL=http://localhost:3000
APP_CLIENT_URL=http://localhost:5173

LOCAL_STORAGE_ROOT=/app/storage
```

Important: when running the backend inside Docker, do **not** use a Windows path like this:

```env
LOCAL_STORAGE_ROOT=E:\DocHubTest\storage
```

The backend container is Linux-based, so the app must use:

```env
LOCAL_STORAGE_ROOT=/app/storage
```

The Docker volume maps `/app/storage` to Docker-managed storage.

Start only the backend stack:

```bash
docker compose up --build mongodb redis backend
```

Even if `docker-compose.yml` contains a `frontend` service, you do not need to run it in this setup.

## 3. Docker storage behavior

The backend stores uploaded PDFs in the Docker volume:

```yaml
backend_storage:/app/storage
```

This means:

- uploaded PDFs are stored inside Docker-managed storage;
- old PDFs from a Windows/local storage folder are not automatically available;
- after resetting Docker volumes, you must upload documents again.

To reset the Docker backend database and file storage completely:

```bash
docker compose down -v --remove-orphans
docker compose up --build mongodb redis backend
```

Warning: `down -v` deletes MongoDB data and uploaded PDFs stored in Docker volumes.

## 4. Frontend setup locally

Open another terminal and go to the frontend repository:

```bash
cd DocHubFE
npm install
```

Create `.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
VITE_APRYSE_LICENSE_KEY=your_apryse_license_key_or_blank_for_demo
```

Apryse WebViewer requires static assets under:

```txt
public/webviewer/lib
```

If the project has a copy script, run:

```bash
npm run copy:webviewer
```

If there is no copy script yet, copy the assets manually.

PowerShell:

```powershell
Remove-Item -Recurse -Force public\webviewer -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force public\webviewer\lib
Copy-Item -Recurse node_modules\@pdftron\webviewer\public\* public\webviewer\lib\
```

Bash:

```bash
rm -rf public/webviewer
mkdir -p public/webviewer/lib
cp -R node_modules/@pdftron/webviewer/public/. public/webviewer/lib/
```

Then start the frontend:

```bash
npm run dev
```

Open:

```txt
http://localhost:5173
```

## 5. Verify backend and PDF serving

After uploading a PDF, the document detail API should return `200`:

```txt
GET http://localhost:3000/api/workspaces/:workspaceId/documents/:documentId
```

The returned `pdfFileUrl` should look like:

```txt
http://localhost:3000/storage/documents/:workspaceId/:documentId.pdf
```

You can verify it with:

```bash
curl -I "http://localhost:3000/storage/documents/:workspaceId/:documentId.pdf"
```

Expected result:

```txt
HTTP/1.1 200 OK
Content-Type: application/pdf
```

## 6. Important Apryse/Vite cache note

While developing the PDF viewer, open Chrome DevTools and enable:

```txt
Network tab -> Disable cache
```

Keep DevTools open while testing.

This avoids stale Vite/browser cache issues with Apryse static assets. If you see errors like:

```txt
GET /webviewer/lib/@vite/client 404
GET /webviewer/lib/src/main.jsx 404
```

first try:

1. enable **Disable cache** in the Network tab;
2. hard reload with `Ctrl + Shift + R`;
3. verify this URL returns the Apryse UI HTML:

```txt
http://localhost:5173/webviewer/lib/ui/index.html
```

These errors usually mean the browser cached an old Vite fallback response before the WebViewer assets were copied correctly. They are usually not caused by the Docker backend.

## 7. Daily development flow

Terminal 1, backend:

```bash
cd DocHubBE
docker compose up mongodb redis backend
```

Terminal 2, frontend:

```bash
cd DocHubFE
npm run dev
```

Then use the app at:

```txt
http://localhost:5173
```
