## Guards and Interceptors

### 1. Overview

#### Goal

Guards and interceptors are used as infrastructure helpers around controller endpoints.

They solve different problems:

```txt
Guard:
  Decides whether a request is allowed to continue.

Interceptor:
  Runs before/after controller execution to transform input/output or apply cross-cutting behavior.
```

In FOLIO, permission enforcement is mainly handled by guards.

Interceptors are used for:

```txt
Logging requests
Formatting paginated responses
Handling multipart file upload
```

---

### 2. Guard Usage

#### Goal

Guards protect routes before the controller method is executed.

The backend uses guards to ensure that the current user has the required permission before accessing workspace or document resources.

The main permission guards are:

```txt
WorkspacePermissionGuard
DocumentPermissionGuard
```

There is also a global authentication guard:

```txt
ProtectGuard
```

The global guard verifies the user session first. Then the workspace/document permission guards check whether the authenticated user has enough permission for the target resource.

---

### 3. WorkspacePermissionGuard

#### Goal

`WorkspacePermissionGuard` protects workspace-level actions.

It checks permissions such as:

```txt
workspace:view
workspace:create_document
workspace:manage_settings
workspace:invite_member
workspace:remove_member
workspace:change_member_role
workspace:delete
workspace:view_activity_log
```

#### How It Works

The route declares required permissions using:

```ts
@RequireWorkspacePermission('workspace:view')
```

or:

```ts
@RequireWorkspacePermission('workspace:create_document')
```

The decorator stores required permissions as route metadata.

When the request reaches the guard, the guard:

```txt
1. Reads required workspace permissions from route metadata.
2. Gets current user ID from req.user.
3. Gets workspaceId from req.params.workspaceId.
4. Calls permissionsService.canWorkspace(userId, workspaceId, permission).
5. Allows the request only if all required permissions return true.
```

If the user is not authenticated:

```txt
401 Unauthorized
```

If `workspaceId` is missing:

```txt
400 Bad Request
```

If the user does not have permission:

```txt
403 Forbidden
```

#### Example Usage

```ts
@Get(':workspaceId')
@UseGuards(WorkspacePermissionGuard)
@RequireWorkspacePermission('workspace:view')
findOne() {
  // Only workspace members with workspace:view can reach this method.
}
```

Another example:

```ts
@Post(':workspaceId/invitations')
@UseGuards(WorkspacePermissionGuard)
@RequireWorkspacePermission('workspace:invite_member')
inviteMember() {
  // Only workspace admins can invite members.
}
```

---

### 4. Workspace Guard in Document Routes

#### Goal

Some document actions are protected by workspace permission because they are actions inside the workspace document collection.

The `DocumentController` is mounted under:

```txt
/workspaces/:workspaceId/documents
```

The controller uses:

```ts
@UseGuards(WorkspacePermissionGuard)
```

at class level.

This means workspace permission can be applied to document collection endpoints.

#### Examples

Creating a markdown document requires:

```txt
workspace:create_document
```

Uploading a PDF requires:

```txt
workspace:create_document
```

Creating an upload job requires:

```txt
workspace:create_document
```

Cancelling an upload requires:

```txt
workspace:create_document
```

Listing documents requires:

```txt
workspace:view
```

These are workspace-level operations because they affect or read the workspace document collection.

---

### 5. DocumentPermissionGuard

#### Goal

`DocumentPermissionGuard` protects actions on one specific document.

It checks permissions such as:

```txt
document:view
document:edit
document:rename
document:delete
document:manage_access
document:comment
```

#### How It Works

The route declares required permissions using:

```ts
@RequireDocumentPermissions('document:view')
```

or:

```ts
@RequireDocumentPermissions('document:edit')
```

The decorator stores the required permissions as route metadata.

When the request reaches the guard, the guard:

```txt
1. Reads required document permissions from route metadata.
2. Gets current user ID from req.user.
3. Gets workspaceId from req.params.workspaceId.
4. Gets documentId from req.params.documentId.
5. Calls permissionsService.canDocument(userId, workspaceId, documentId, permission).
6. Allows the request only if all required permissions return true.
```

If the user is not authenticated:

```txt
401 Unauthorized
```

If `workspaceId` or `documentId` is missing:

```txt
400 Bad Request
```

If the user does not have permission:

```txt
403 Forbidden
```

#### Example Usage

```ts
@Get(':documentId')
@UseGuards(DocumentPermissionGuard)
@RequireDocumentPermissions('document:view')
findOne() {
  // Only users with document:view can open the document.
}
```

Another example:

```ts
@Patch(':documentId/content')
@UseGuards(DocumentPermissionGuard)
@RequireDocumentPermissions('document:edit')
editPdf() {
  // Only users with document:edit can save edited PDF content.
}
```

---

### 6. Why Both Workspace and Document Guards Are Needed

#### Goal

Workspace actions and document actions have different scopes.

The system uses different guards to keep permission checks clear.

#### Workspace-level Actions

Workspace-level actions answer this question:

```txt
Can this user do this action in the workspace?
```

Examples:

```txt
Create document
Upload PDF
List workspace documents
Invite workspace member
Update workspace settings
Delete workspace
```

These actions use:

```txt
WorkspacePermissionGuard
```

#### Document-level Actions

Document-level actions answer this question:

```txt
Can this user do this action on this specific document?
```

Examples:

```txt
View document detail
Edit PDF content
Rename document
Delete document
Manage document access
Create or delete comments
```

These actions use:

```txt
DocumentPermissionGuard
```

#### Example Difference

A workspace member may have:

```txt
workspace:create_document
```

so they can create documents.

But they may not have:

```txt
document:manage_access
```

so they cannot open the document sharing management panel.

This separation prevents workspace collaboration permissions from automatically becoming document management permissions.

---

### 7. Decorator Role

#### Goal

Permission decorators keep controllers readable.

Instead of manually checking permission inside every method, the controller declares the required permission above the route.

#### Workspace Decorator

```ts
@RequireWorkspacePermission('workspace:view')
```

This stores metadata under:

```txt
workspace_permissions
```

The workspace guard reads this metadata.

#### Document Decorator

```ts
@RequireDocumentPermissions('document:view')
```

This stores metadata under:

```txt
document_permissions
```

The document guard reads this metadata.

#### Benefit

The controller becomes declarative.

Example:

```ts
@Patch(':documentId/rename')
@UseGuards(DocumentPermissionGuard)
@RequireDocumentPermissions('document:rename')
rename() {
  // business logic only
}
```

The permission rule is visible at the route level, while the actual permission resolution stays centralized in `PermissionsService`.

---

### 8. PermissionsService Role

#### Goal

The guards do not directly know role logic.

They delegate the actual permission decision to:

```txt
PermissionsService
```

The guards only do orchestration:

```txt
Read metadata
Read userId / workspaceId / documentId
Call permission service
Throw error or allow request
```

The permission service handles actual access logic, such as:

```txt
Workspace role -> workspace permissions
Workspace role -> implied document role
Explicit document permission
Document ownership
External document access
```

This keeps guards simple and reusable.

---

### 9. Interceptor Usage

#### Goal

Interceptors are used for cross-cutting behavior around controller execution.

Unlike guards, interceptors do not mainly decide whether a request is allowed.

They are used to:

```txt
Log request information
Format paginated responses
Parse multipart file uploads
```

---

### 10. Global LoggingInterceptor

#### Goal

`LoggingInterceptor` logs basic request information and request duration.

It is registered globally as an `APP_INTERCEPTOR`.

This means it runs for all routes.

#### Behavior

For each request, it logs:

```txt
date
HTTP method
request URL
IP address
duration in milliseconds
```

This helps with debugging and observing API behavior.

---

### 11. Pagination Response Interceptors

#### Goal

Pagination interceptors normalize paginated service responses into a consistent frontend-friendly shape.

There are two pagination interceptors:

```txt
PagePaginationResponseInterceptor
PaginationResponseInterceptor
```

#### PagePaginationResponseInterceptor

Used for page-based pagination.

It transforms service response from:

```txt
items
page
limit
totalItems
totalPages
hasNextPage
hasPreviousPage
```

into:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Example usage:

```ts
@Get()
@UseInterceptors(PagePaginationResponseInterceptor)
findAll() {
  // service returns paginated result
}
```

#### PaginationResponseInterceptor

Used for cursor-based pagination.

It transforms service response from:

```txt
items
nextCursor
hasMore
```

into:

```json
{
  "data": [],
  "meta": {
    "nextCursor": "...",
    "hasMore": true
  }
}
```

---

### 12. FileInterceptor

#### Goal

`FileInterceptor` handles multipart file upload.

It is used on document upload and PDF edit endpoints.

#### Upload PDF

```ts
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: ...
}))
```

This interceptor:

```txt
Reads multipart/form-data
Extracts the file field
Applies file size limit
Rejects non-PDF files
Makes the uploaded file available as @UploadedFile()
```

#### Edit PDF

The edit PDF endpoint also uses `FileInterceptor('file')`.

It validates that the edited file is still a PDF before passing it to the service.

---

### 13. Guard and Interceptor Execution Flow

#### Goal

Understand the request lifecycle.

For a protected document upload route, the flow is roughly:

```txt
Request arrives
-> Global ProtectGuard authenticates user
-> WorkspacePermissionGuard checks workspace:create_document
-> FileInterceptor parses multipart file
-> Controller method runs
-> Service handles business logic
-> LoggingInterceptor logs duration
-> Response returned
```

For a protected document edit route:

```txt
Request arrives
-> Global ProtectGuard authenticates user
-> DocumentPermissionGuard checks document:edit
-> FileInterceptor parses edited PDF
-> Controller method runs
-> Service overwrites PDF and queues extraction
-> LoggingInterceptor logs duration
-> Response returned
```

For a paginated list route:

```txt
Request arrives
-> Global ProtectGuard authenticates user
-> WorkspacePermissionGuard checks workspace:view
-> Controller returns paginated result
-> PagePaginationResponseInterceptor formats response
-> LoggingInterceptor logs duration
-> Response returned
```

---

### 14. Why Use This Design

#### Centralized Permission Logic

Permission rules are not scattered across controller methods.

Controllers only declare:

```txt
Required permission
Required guard
```

The real permission logic stays in `PermissionsService`.

#### Clear Route-level Security

By reading controller decorators, it is easy to see what permission protects each endpoint.

Example:

```ts
@RequireDocumentPermissions('document:delete')
```

clearly means the route requires document delete permission.

#### Reusable Guards

The same guards can protect many modules.

Examples:

```txt
WorkspaceController
DocumentController
CommentController
ShareDocumentController
ActivityController
```

#### Consistent Response Shape

Pagination interceptors keep API responses consistent.

Controllers and services can focus on data, while interceptors format the final response.

#### Clean File Upload Handling

`FileInterceptor` keeps multipart parsing and file validation outside business logic.

The service receives a ready file buffer instead of manually parsing request streams.

---

### 15. Summary

#### Guards

```txt
ProtectGuard:
  Global authentication guard.

WorkspacePermissionGuard:
  Protects workspace-level actions.
  Reads @RequireWorkspacePermission metadata.
  Calls permissionsService.canWorkspace().

DocumentPermissionGuard:
  Protects document-level actions.
  Reads @RequireDocumentPermissions metadata.
  Calls permissionsService.canDocument().
```

#### Interceptors

```txt
LoggingInterceptor:
  Global request logging and timing.

PagePaginationResponseInterceptor:
  Formats page-based pagination response.

PaginationResponseInterceptor:
  Formats cursor-based pagination response.

FileInterceptor:
  Parses multipart file upload and validates PDF files.
```

#### Final Rule

```txt
Guards decide whether a request can continue.
Interceptors transform or handle request/response behavior around the controller.
WorkspacePermissionGuard protects workspace scope.
DocumentPermissionGuard protects document scope.
```
