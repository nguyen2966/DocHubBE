## Infrastructure: Storage Provider

### 1. Overview

#### Goal

The storage provider is an infrastructure abstraction used by the backend to store and retrieve document PDF files.

The application does not store PDF binary data directly inside MongoDB. MongoDB stores only document metadata, while the actual PDF file is stored through the storage provider.

The storage layer is responsible for:

```txt
Upload file
Overwrite file
Download file
Delete file
Check file existence
Resolve public URL
```

This design keeps the Document module independent from the actual storage technology.

The current implementation uses local disk storage, but the interface is designed so it can be replaced by an S3-like provider later.

---

### 2. Storage Contract

#### Goal

The storage contract defines the behavior that every storage provider must implement.

The application depends on this abstraction instead of depending directly on local filesystem APIs or AWS S3 APIs.

The contract contains these operations:

```txt
upload
overwrite
download
delete
exists
getPublicUrl
```

#### Upload

```txt
upload(key, buffer, mimeType)
```

Uploads a new file and returns:

```txt
fileKey
publicUrl
```

The `fileKey` is the stable internal identifier of the stored file.

The `publicUrl` is the URL that the frontend can use to load the file.

#### Overwrite

```txt
overwrite(key, buffer, mimeType)
```

Replaces the existing file at the same key.

This is used when a PDF is edited through Apryse and saved back to the same document.

#### Download

```txt
download(key)
```

Reads the stored file and returns it as a `Buffer`.

This is used by background workers when extracting text from PDFs.

#### Delete

```txt
delete(key)
```

Removes the stored file.

This is used during upload cancellation or cleanup.

#### Exists

```txt
exists(key)
```

Checks whether a file exists.

This is useful for defensive checks or future cleanup flows.

#### Get Public URL

```txt
getPublicUrl(key)
```

Returns a URL that can be used by the frontend viewer.

For local storage, this is a normal static URL.

For S3, this could be a public object URL, CDN URL, or signed URL.

---

### 3. Why This Can Mock S3 Behavior

#### Goal

The storage interface can imitate the important behavior of S3 because the application treats files as key-based objects.

S3 is essentially an object storage system.

A file is stored using:

```txt
bucket + key -> object bytes
```

In this app, the storage contract uses the same mental model:

```txt
key -> file bytes
```

The rest of the application does not need to know where the file is physically stored.

#### S3-like Mapping

| Storage Contract | S3 Equivalent | Local Storage Equivalent |
|---|---|---|
| `upload(key, buffer, mimeType)` | `PutObject` | `fs.writeFileSync(root/key, buffer)` |
| `overwrite(key, buffer, mimeType)` | `PutObject` with same key | `fs.writeFileSync(root/key, buffer)` |
| `download(key)` | `GetObject` | `fs.readFileSync(root/key)` |
| `delete(key)` | `DeleteObject` | `fs.unlinkSync(root/key)` |
| `exists(key)` | `HeadObject` | `fs.existsSync(root/key)` |
| `getPublicUrl(key)` | public URL / signed URL / CDN URL | `APP_URL/storage/key` |

Because both local storage and S3 can be represented as:

```txt
stable key -> binary file content
```

the same Document service can work with either implementation.

---

### 4. Dependency Injection Design

#### Goal

The backend uses dependency injection to choose the active storage provider.

The storage module binds the abstract storage contract to the local storage implementation:

```txt
StorageContract -> LocalStorageProvider
```

Other modules inject only the contract:

```txt
StorageContract
```

They do not inject `LocalStorageProvider` directly.

#### Why This Matters

This makes the system replaceable.

Current setup:

```txt
StorageContract -> LocalStorageProvider
```

Future setup:

```txt
StorageContract -> S3StorageProvider
```

The Document module does not need to change because it still calls the same methods:

```txt
storage.upload(...)
storage.overwrite(...)
storage.download(...)
storage.delete(...)
storage.getPublicUrl(...)
```

Only the provider implementation changes.

---

### 5. Canonical Storage Key

#### Goal

Every document PDF uses a stable storage key.

The app builds document storage keys using this format:

```txt
documents/{workspaceId}/{documentId}.pdf
```

Example:

```txt
documents/6a2f888d0204fab9effb8d27/6a37f0d3c36265ed155f6a71.pdf
```

This key is stored in the document record as:

```txt
pdfStorageKey
```

The storage key is important because it is independent from the storage backend.

In local storage, it becomes a file path.

In S3, it becomes an object key.

#### Why Key-based Storage Is Useful

The application can keep one stable reference to the file.

```txt
Document record
  pdfStorageKey = documents/{workspaceId}/{documentId}.pdf
```

Then the storage provider decides how to resolve it.

Local provider:

```txt
storage root + key
```

S3 provider:

```txt
bucket + key
```

CDN provider:

```txt
cdn base URL + key
```

---

### 6. How Local Storage Works

#### Goal

Local storage stores PDF files on the server filesystem.

It is useful for local development, simple deployment, and testing without external cloud storage.

#### Root Folder

The local storage provider uses:

```txt
LOCAL_STORAGE_ROOT
```

If no root is configured, it falls back to:

```txt
process.cwd()/storage
```

So a document key like:

```txt
documents/workspaceId/documentId.pdf
```

becomes a real file path like:

```txt
{LOCAL_STORAGE_ROOT}/documents/workspaceId/documentId.pdf
```

or:

```txt
{projectRoot}/storage/documents/workspaceId/documentId.pdf
```

---

### 6.1 Upload

#### Flow

```txt
upload(key, buffer, mimeType)
-> resolve full path from root + key
-> create parent directory if needed
-> write buffer to disk
-> return fileKey and publicUrl
```

Example:

```txt
key:
  documents/workspaceId/documentId.pdf

full path:
  storage/documents/workspaceId/documentId.pdf
```

The provider creates missing folders recursively before writing the file.

Result:

```json
{
  "fileKey": "documents/workspaceId/documentId.pdf",
  "publicUrl": "http://localhost:3000/storage/documents/workspaceId/documentId.pdf"
}
```

---

### 6.2 Overwrite

#### Flow

```txt
overwrite(key, buffer, mimeType)
-> resolve full path
-> create parent directory if needed
-> write new buffer to the same path
```

This replaces the existing file content.

It is used by the PDF edit flow:

```txt
User edits PDF in Apryse
-> Frontend exports edited PDF
-> Backend receives edited PDF buffer
-> storage.overwrite(pdfStorageKey, buffer, application/pdf)
```

The document keeps the same `pdfStorageKey`, but the file content changes.

This is similar to uploading a new object to the same key in S3.

---

### 6.3 Download

#### Flow

```txt
download(key)
-> resolve full path
-> check whether file exists
-> read file into Buffer
```

If the file does not exist, the provider throws a not found error.

This is used mainly by background workers.

Example:

```txt
extract-pdf job
-> storage.download(storageKey)
-> pdf-parse extracts text from Buffer
-> update document extractedTextPreview
```

---

### 6.4 Delete

#### Flow

```txt
delete(key)
-> resolve full path
-> if file exists, remove it
```

If the file does not exist, local delete does nothing.

This makes cleanup safer because repeated delete calls do not crash the flow.

Common usage:

```txt
Cancel upload
-> delete partially uploaded PDF
-> delete temporary document record
```

---

### 6.5 Exists

#### Flow

```txt
exists(key)
-> resolve full path
-> check file existence
```

This is equivalent to checking whether the object exists in storage.

---

### 6.6 Public URL

#### Flow

```txt
getPublicUrl(key)
-> convert path separators to URL separators
-> return APP_URL + /storage + key
```

Example:

```txt
APP_URL:
  http://localhost:3000

key:
  documents/workspaceId/documentId.pdf

publicUrl:
  http://localhost:3000/storage/documents/workspaceId/documentId.pdf
```

On Windows, file paths may contain backslashes.

The provider converts path separators into `/` so the final URL is valid.

---

### 7. Serving Local Files

#### Goal

Local files must be accessible by the frontend PDF viewer.

The backend exposes the local storage folder as static assets.

Static serving rule:

```txt
LOCAL_STORAGE_ROOT -> /storage/*
```

So this file:

```txt
{LOCAL_STORAGE_ROOT}/documents/workspaceId/documentId.pdf
```

can be opened through:

```txt
{APP_URL}/storage/documents/workspaceId/documentId.pdf
```

The frontend uses this URL as the PDF source.

---

### 8. How the Document Module Uses Storage

#### Markdown Document

```txt
User creates markdown document
-> Worker converts markdown to PDF buffer
-> storage.upload(documentKey, pdfBuffer, application/pdf)
-> document.pdfStorageKey = documentKey
-> document.pdfFileUrl = publicUrl
```

#### Uploaded PDF

```txt
User uploads PDF
-> Backend receives file buffer
-> storage.upload(documentKey, file.buffer, application/pdf)
-> document.pdfStorageKey = documentKey
-> document.pdfFileUrl = publicUrl
-> Worker later calls storage.download(documentKey)
```

#### Edited PDF

```txt
User edits PDF
-> Frontend exports edited PDF
-> Backend receives edited PDF buffer
-> storage.overwrite(existingPdfStorageKey, buffer, application/pdf)
-> Worker later calls storage.download(existingPdfStorageKey)
```

#### Cancel Upload

```txt
User cancels upload
-> Backend checks upload job
-> If file exists, storage.delete(pdfStorageKey)
-> Delete temporary document metadata
```

#### View Document

```txt
Frontend opens document
-> Backend reads document metadata
-> Backend resolves fresh URL using storage.getPublicUrl(pdfStorageKey)
-> Frontend opens PDF viewer with that URL
```

---

### 9. Why Not Store PDF in MongoDB

#### Goal

Keep MongoDB focused on metadata and searchable text, not large binary files.

PDF files can be large. Storing them directly inside MongoDB documents would make queries heavier and increase database size quickly.

Instead, the app stores:

```txt
MongoDB:
  document metadata
  pdfStorageKey
  pdfFileUrl
  extractedTextPreview
  processingStatus

Storage provider:
  actual PDF bytes
```

This is a common architecture for document systems.

MongoDB remains efficient for metadata queries, permissions, search preview, and activity logs.

The storage provider handles binary file operations.

---

### 10. Local Storage vs S3

#### Local Storage

Local storage is simple and useful during development.

Advantages:

```txt
No cloud setup required
Easy to inspect files manually
Fast local testing
No external network dependency
Works well for one local backend instance
```

Limitations:

```txt
Files are tied to one server machine
Not ideal for horizontal scaling
No built-in bucket policy
No signed URL support by default
No object versioning
No managed durability like S3
```

#### S3 Storage

An S3 provider would be better for production.

Advantages:

```txt
Durable object storage
Works across multiple backend instances
Can generate signed URLs
Can integrate with CDN
Can support object metadata
Can scale independently from the backend server
```

The storage contract already provides the core operations needed to switch to S3 later.

---

### 11. Future S3 Provider

#### Goal

Replace local storage without changing the Document module.

A future S3 implementation would still implement the same contract:

```txt
upload
overwrite
download
delete
exists
getPublicUrl
```

Possible S3 behavior:

```txt
upload:
  PutObject to S3 bucket

overwrite:
  PutObject to the same key

download:
  GetObject and convert stream to Buffer

delete:
  DeleteObject

exists:
  HeadObject

getPublicUrl:
  Return CDN URL, public object URL, or signed URL
```

The provider binding would change from:

```txt
StorageContract -> LocalStorageProvider
```

to:

```txt
StorageContract -> S3StorageProvider
```

All consumers keep using the same `StorageContract`.

---

### 12. Important Notes

#### mimeType Is Part of the Contract

The contract accepts `mimeType` even though the local provider does not use it deeply.

This is intentional because S3 would use it as object metadata:

```txt
ContentType = application/pdf
```

Keeping `mimeType` in the interface makes the local provider compatible with a future S3 provider.

#### Public URL May Be Dynamic

In local storage, `getPublicUrl` returns a stable static URL.

In S3, `getPublicUrl` may return:

```txt
Public S3 URL
CloudFront CDN URL
Signed URL that expires
```

This is why document detail resolves a fresh URL from storage instead of blindly trusting an old stored URL.

#### Overwrite Keeps Document Identity Stable

Edited PDFs overwrite the same storage key.

This means:

```txt
documentId stays the same
pdfStorageKey stays the same
file content changes
document version increments
```

This is useful because comments, permissions, and activity logs remain attached to the same document.

---

### 13. Summary

#### Current Implementation

```txt
StorageContract -> LocalStorageProvider
```

#### Local Storage Behavior

```txt
key -> local file path
buffer -> file bytes
APP_URL/storage/key -> public URL
```

#### S3-like Behavior

```txt
key -> object key
buffer -> object body
getPublicUrl -> object URL or signed URL
```

#### Main Storage Operations

```txt
upload:
  Store new PDF

overwrite:
  Replace existing PDF content

download:
  Read PDF for processing

delete:
  Cleanup file

exists:
  Check file availability

getPublicUrl:
  Resolve viewer URL
```

#### Final Rule

```txt
The application depends on StorageContract, not on local disk or S3 directly.
LocalStorageProvider mocks S3-like key-based object storage using the server filesystem.
A future S3StorageProvider can replace it without changing document business logic.
```
