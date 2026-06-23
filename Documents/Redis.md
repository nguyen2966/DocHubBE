## Infrastructure: CacheModule and BullMQ

### 1. Overview

#### Goal

The system uses Redis-backed infrastructure for two different purposes:

```txt
CacheModule:
  Store short-lived cache data and token blacklist data.

BullMQ:
  Run long-running document processing tasks in the background.
```

Both are connected to Redis, but they solve different problems.

```txt
CacheModule = fast key-value cache
BullMQ = background job queue
```

---

### 2. CacheModule

#### Goal

CacheModule provides a global cache layer backed by Redis.

It is configured once in the root application module and can be injected into any service through NestJS dependency injection.

The system currently uses CacheModule mainly for access token revocation.

---

### 2.1 How CacheModule Is Configured

#### Flow

```txt
AppModule
-> CacheModule.registerAsync()
-> use Redis store
-> connect to REDIS_HOST and REDIS_PORT
-> make cache global
```

Because it is global, services do not need to import CacheModule repeatedly.

They can inject:

```txt
CACHE_MANAGER
```

and use the cache manager directly.

---

### 2.2 How Token Revocation Uses CacheModule

#### Goal

Access tokens are JWTs. JWTs are normally stateless, so once issued, they remain valid until expiration.

To support logout and token revocation, the system stores revoked access token IDs in Redis.

Each access token contains a unique `jti`.

When the user logs out, the backend stores:

```txt
key:
  revoked_at:{jti}

value:
  logout reason

ttl:
  remaining lifetime of the access token
```

Example:

```txt
revoked_at:550e8400-e29b-41d4-a716-446655440000 -> logout
```

The TTL is important. After the access token naturally expires, the blacklist entry is automatically removed from Redis.

---

### 2.3 Why Use CacheModule

#### Fast Token Blacklist Lookup

Every authenticated request may need to check whether the access token was revoked.

Redis is fast for this type of lookup:

```txt
GET revoked_at:{jti}
```

#### Automatic Expiration

Revoked access tokens only need to stay in cache until the original JWT expires.

Redis TTL handles this naturally.

#### Avoid Database Overhead

Storing revoked short-lived access tokens in MongoDB would create unnecessary writes and cleanup work.

Redis is more suitable for temporary data.

#### Keeps JWT Mostly Stateless

The app still uses JWT for normal authentication, but CacheModule adds a small stateful layer for logout/revocation.

---

### 3. BullMQ

#### Goal

BullMQ is used to run heavy document processing tasks outside the HTTP request-response cycle.

The document module has a queue named:

```txt
document-processing
```

This queue handles:

```txt
convert-markdown
extract-pdf
```

---

### 3.1 How BullMQ Is Configured

#### Flow

```txt
AppModule
-> BullModule.forRoot()
-> connect to Redis

DocumentModule
-> BullModule.registerQueue({ name: "document-processing" })
```

The Document service injects this queue and adds jobs when document processing is needed.

The Document processor listens to the same queue and executes jobs in the background.

---

### 3.2 convert-markdown Job

#### Goal

Convert a markdown document into a PDF file.

#### When It Is Added

When a user creates a markdown document, the backend creates the document immediately with:

```txt
processingStatus = processing
```

Then it adds a job:

```txt
convert-markdown
```

#### Worker Behavior

The worker:

```txt
1. Converts markdown to HTML.
2. Uses Puppeteer to render HTML into PDF.
3. Uploads the generated PDF to storage.
4. Generates extractedTextPreview from markdown content.
5. Updates the document status to processed.
```

If conversion fails:

```txt
processingStatus = unprocessable
```

---

### 3.3 extract-pdf Job

#### Goal

Extract searchable text preview from a PDF.

#### When It Is Added

The job is added when:

```txt
A PDF file is uploaded.
An edited PDF is saved.
```

#### Worker Behavior

The worker:

```txt
1. Downloads the PDF from storage.
2. Parses the PDF text.
3. Stores the first 10,000 characters in extractedTextPreview.
4. Marks the document as processed.
```

If extraction fails:

```txt
processingStatus = unprocessable
```

For upload jobs, it also updates upload progress:

```txt
EXTRACTING -> COMPLETED
```

or:

```txt
FAILED
```

---

### 3.4 Upload Cancellation

#### Goal

BullMQ works with the upload job state to support cancellation.

When the user cancels an upload:

```txt
1. Backend marks upload job as CANCELLED.
2. Backend tries to remove the BullMQ job if it is still waiting or delayed.
3. If the worker already started, the worker checks isCancelled before heavy work.
4. Cancelled jobs do not overwrite the document as failed.
```

This makes cancellation cooperative and safe.

---

### 4. Why Use BullMQ

#### Avoid Blocking HTTP Requests

PDF extraction and markdown-to-PDF conversion can be slow.

Without BullMQ, the HTTP request would have to wait for:

```txt
PDF parsing
Puppeteer PDF rendering
Storage upload/download
Text extraction
```

BullMQ lets the API return quickly while the worker processes the document later.

#### Better User Experience

The frontend can show:

```txt
processing
extracting
completed
failed
cancelled
```

instead of freezing during upload or conversion.

#### Reliable Background Processing

BullMQ stores jobs in Redis, so jobs are managed outside the current request.

This gives the system a clear job lifecycle:

```txt
waiting
active
completed
failed
```

#### Separation of Responsibilities

The Document service handles business flow:

```txt
Create document
Save metadata
Add job to queue
Return response
```

The Document processor handles heavy processing:

```txt
Convert markdown
Extract PDF text
Update processing status
```

This keeps controller/service logic cleaner.

---

### 5. CacheModule vs BullMQ

#### Difference

```txt
CacheModule:
  Used for short-lived key-value data.
  Example: revoked access token jti.

BullMQ:
  Used for background jobs.
  Example: extract PDF text after upload.
```

Both use Redis, but they should not be confused.

#### Mental Model

```txt
CacheModule:
  "Remember this small value temporarily."

BullMQ:
  "Do this expensive task later."
```

---

### 6. Summary

#### CacheModule

```txt
Purpose:
  Temporary Redis-backed cache.

Current usage:
  Access token revocation blacklist.

Why:
  Fast lookup, TTL support, avoids MongoDB overhead.
```

#### BullMQ

```txt
Purpose:
  Redis-backed background job queue.

Current queue:
  document-processing

Current jobs:
  convert-markdown
  extract-pdf

Why:
  Prevents slow document processing from blocking HTTP requests.
```

#### Final Rule

```txt
Use CacheModule for temporary key-value state.
Use BullMQ for asynchronous background processing.
```
