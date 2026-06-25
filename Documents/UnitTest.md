# Unit Test Cases

This document describes the independent Jest unit tests added under `test/unit`.
The suite currently contains **91 tests across 19 spec files**.

## API Service Tests

### `test/unit/api/activity.service.spec.ts`

1. **records activity with normalized ObjectIds**  
   Verifies that `ActivityService.record()` converts workspace, actor, and target ids into Mongo `ObjectId` values before creating an activity log.

2. **recordSafe swallows logging failures**  
   Verifies that `recordSafe()` does not throw when activity recording fails, so business operations are not blocked by activity-log errors.

3. **finds paginated workspace activity and normalizes actor shape**  
   Verifies pagination defaults, limit capping, activity mapping, actor normalization, and string id serialization.

4. **rejects invalid action type filters**  
   Verifies that unsupported `actionTypes` query values throw `BadRequestException`.

5. **rejects invalid date ranges**  
   Verifies that `from >= to` date filters are rejected with `BadRequestException`.

6. **maps actor aggregation results to existing users**  
   Verifies that actor aggregation results are joined with user records and missing users are filtered out.

### `test/unit/api/search.service.spec.ts`

7. **searches verified users by escaped email prefix**  
   Verifies that email prefixes are trimmed, lowercased, regex-escaped, and used to find verified, non-deleted users.

8. **marks users that are already workspace members**  
   Verifies that search results include `isMember: true` when the found user already belongs to the workspace.

### `test/unit/api/document-search.service.spec.ts`

9. **searches accessible documents and maps workspace access results**  
   Verifies document search filtering, text-search projection, pagination limit capping, workspace access classification, and preview text mapping.

10. **rejects workspace filters outside the user membership scope**  
    Verifies that users cannot filter search results by workspaces they do not belong to.

11. **rejects invalid updated date filters**  
    Verifies that invalid `updatedFrom` or `updatedTo` values throw `BadRequestException`.

12. **maps workspace filter options from active memberships**  
    Verifies that workspace filter options include active workspaces and exclude deleted workspaces.

### `test/unit/api/upload-job.service.spec.ts`

13. **creates an upload job and returns the generated id**  
    Verifies that upload-job creation stores the initial `UPLOADING` state and returns the generated job id.

14. **returns null and emits nothing when update target is missing**  
    Verifies that updating a missing upload job returns `null` and does not emit websocket progress.

15. **updates a job and emits progress payload**  
    Verifies that upload-job updates persist progress and emit the expected websocket payload.

## System Service Tests

### `test/unit/system/permissions.service.spec.ts`

16. **denies workspace permissions without membership**  
    Verifies that users without workspace membership cannot perform workspace actions.

17. **allows workspace permissions from role map**  
    Verifies that workspace role permissions are resolved from `WORKSPACE_ROLE_PERMISSIONS`.

18. **allows explicit document roles when the role includes the permission**  
    Verifies that direct document roles such as `editor` grant their mapped document permissions.

19. **does not allow owner document role without workspace membership**  
    Verifies the business rule that explicit `owner` document access is valid only while the user is a workspace member.

20. **uses workspace role as implied document role**  
    Verifies that workspace membership can imply document permissions through `WORKSPACE_ROLE_TO_DOCUMENT_ROLE`.

21. **returns effective owner only when owner is also a workspace member**  
    Verifies effective-role calculation for owners who still belong to the workspace.

22. **bulk maps final document permissions**  
    Verifies batch permission mapping for multiple documents, including direct owner and implied workspace roles.

23. **returns no available document permissions when there is no effective role**  
    Verifies that users with no effective document role receive an empty permissions array.

### `test/unit/system/token.service.spec.ts`

24. **signs access tokens with subject and jti**  
    Verifies that access tokens are signed with `sub` and `jti` claims.

25. **delegates access token decode and verify to JwtService**  
    Verifies that decode and verify behavior is delegated to Nest `JwtService`.

26. **does not blacklist already expired access tokens**  
    Verifies that expired access tokens are not written to the revocation cache.

27. **blacklists active access tokens until their expiry**  
    Verifies that active access tokens are stored in the cache with a TTL when revoked.

28. **checks whether an access token was revoked**  
    Verifies revoked-token lookup behavior from the cache.

29. **generates token pairs and persists hashed refresh tokens**  
    Verifies access-token creation, raw refresh-token generation, refresh-token hashing, family id creation, expiry, and device info persistence.

30. **rejects unknown refresh tokens**  
    Verifies that a refresh token with no matching hash throws `UnauthorizedException`.

31. **revokes the whole refresh-token family on reuse detection**  
    Verifies refresh-token reuse detection and family-wide revocation.

32. **rejects expired refresh tokens**  
    Verifies that expired refresh tokens cannot be rotated.

33. **rotates valid refresh tokens and revokes the old record**  
    Verifies successful refresh-token rotation, new token persistence, and old token revocation.

34. **revokes one refresh token and all user refresh tokens**  
    Verifies logout-style single refresh-token revocation and manual revoke-all behavior.

### `test/unit/system/email.service.spec.ts`

35. **replaces old verification token and queues a verification email**  
    Verifies old verification-token cleanup, new Redis token storage, user-token mapping, and queue payload creation.

36. **rejects invalid verification tokens**  
    Verifies that missing or expired verification tokens throw `BadRequestException`.

37. **rejects verification from a different signup nonce**  
    Verifies that email verification must happen from the same signup browser nonce.

38. **consumes a valid token and marks the user as verified**  
    Verifies one-time token consumption, user verification, save behavior, and Redis cleanup.

39. **queues workspace invitation emails**  
    Verifies that workspace invitation emails are submitted to the email queue with retry options.

### `test/unit/system/redis.service.spec.ts`

40. **sets values with and without ttl**  
    Verifies Redis `SET` calls with plain values and `EX` TTL values.

41. **uses native getdel when available**  
    Verifies that native Redis `GETDEL` is preferred when available.

42. **falls back to eval when getdel is not available**  
    Verifies Lua fallback behavior for Redis clients without native `GETDEL`.

43. **returns null from getDel fallback for non-string redis responses**  
    Verifies safe handling of non-string fallback responses.

44. **serializes and parses JSON helpers**  
    Verifies `setJson`, `getJson`, and `getDelJson` behavior.

## Controller and Boundary Tests

### `test/unit/api/auth.controller.spec.ts`

45. **registers and stores signup nonce in a cookie without returning it**  
    Verifies that registration stores `signupNonce` in a cookie and returns only the public message.

46. **verifies email, sets auth cookies, and clears signup nonce**  
    Verifies verification request mapping, auth-cookie creation, signup-cookie clearing, and response shape.

47. **logs in and sets auth cookies**  
    Verifies login request mapping and access/refresh cookie creation.

48. **refreshes token from cookie and rotates auth cookies**  
    Verifies refresh-token extraction from cookies, device info mapping, and rotated cookie writes.

49. **logs out and clears auth cookies**  
    Verifies logout token payload mapping and clearing of auth cookies.

### `test/unit/api/document.controller.spec.ts`

50. **rejects non-markdown source type on create endpoint**  
    Verifies that the markdown creation endpoint rejects unsupported source types.

51. **delegates markdown creation with workspace and user ids**  
    Verifies that document creation receives the correct workspace id, user id, and DTO.

52. **requires file and jobId for PDF upload**  
    Verifies upload validation for missing file and missing upload job id.

53. **uses original PDF filename as title when upload title is omitted**  
    Verifies fallback title derivation from the uploaded PDF filename.

54. **adds bulk permissions to document list responses**  
    Verifies that document-list responses include permissions from bulk permission lookup.

### `test/unit/api/workspace.controller.spec.ts`

55. **delegates workspace CRUD operations with authenticated user id**  
    Verifies request mapping for create, list, find one, and update workspace operations.

56. **delegates member and invitation operations**  
    Verifies request mapping for role updates, member removal, leaving, inviting, and invitation cancellation.

57. **redirects invalid invitation links**  
    Verifies that invalid invitation actions redirect to the invalid invitation page.

58. **redirects sign-up invitation links**  
    Verifies that sign-up invitation actions redirect to sign-up with the invitation token.

59. **redirects sign-in invitation links**  
    Verifies that sign-in invitation actions redirect to the frontend accept flow.

60. **redirects accepted invitation links**  
    Verifies that accepted invitations redirect to the workspace document list.

### `test/unit/api/share-document.controller.spec.ts`

61. **delegates document access management endpoints**  
    Verifies argument mapping for access lookup, user search, share, role update, and access removal.

62. **delegates share invitation endpoints**  
    Verifies argument mapping for resolving and accepting document-share invitation tokens.

### `test/unit/api/remaining-controllers.spec.ts`

63. **ActivityController delegates list and actor lookup**  
    Verifies activity controller delegation for actor filters and paginated activity logs.

64. **SearchController delegates email search**  
    Verifies search controller DTO mapping to `SearchService.searchByEmail()`.

65. **DocumentSearchController delegates search endpoints with user id**  
    Verifies authenticated user id mapping for global document search and workspace filter options.

66. **MySharedDocumentController delegates list and detail endpoints**  
    Verifies authenticated user id mapping for shared-with-me list and detail endpoints.

## Guard Tests

### `test/unit/common/protect.guard.spec.ts`

67. **allows public handlers without reading cookies**  
    Verifies that public routes bypass token verification.

68. **rejects requests without access token**  
    Verifies that protected routes require an access token.

69. **allows optional auth requests without access token**  
    Verifies that optional-auth routes allow anonymous requests.

70. **rejects revoked access tokens**  
    Verifies that revoked access tokens are rejected.

71. **attaches user and token payload for valid tokens**  
    Verifies that valid tokens attach `req.user` and `req.tokenPayload`.

72. **maps expired tokens to an explicit UnauthorizedException**  
    Verifies that JWT expiry produces the expected authentication error.

73. **rethrows formatted forbidden errors**  
    Verifies that known Nest exceptions are preserved instead of being replaced by generic authentication failures.

### `test/unit/common/optional-auth.guard.spec.ts`

74. **allows requests without access token**  
    Verifies that optional auth succeeds when no cookie exists.

75. **allows invalid tokens without attaching user**  
    Verifies that invalid optional-auth tokens do not block the request.

76. **does not attach revoked tokens**  
    Verifies that revoked optional-auth tokens are ignored.

77. **attaches user for valid optional auth tokens**  
    Verifies that valid optional-auth tokens populate user and token payload data.

### `test/unit/system/permission-guards.spec.ts`

78. **WorkspacePermissionGuard allows handlers without required permissions**  
    Verifies that workspace permission checks are skipped when no metadata is present.

79. **WorkspacePermissionGuard requires an authenticated user**  
    Verifies that missing authenticated user data throws `UnauthorizedException`.

80. **WorkspacePermissionGuard requires workspaceId route param**  
    Verifies that missing workspace id throws `BadRequestException`.

81. **WorkspacePermissionGuard rejects when any required workspace permission is denied**  
    Verifies that all required workspace permissions must pass.

82. **DocumentPermissionGuard allows when all document permissions pass**  
    Verifies successful document permission checks.

83. **DocumentPermissionGuard requires documentId route param**  
    Verifies that missing document id throws `BadRequestException`.

## Utility and Interceptor Tests

### `test/unit/common/mongo-id.util.spec.ts`

84. **converts a valid string into an ObjectId**  
    Verifies valid string-to-`ObjectId` conversion.

85. **returns an existing ObjectId unchanged**  
    Verifies `ObjectId` passthrough behavior.

86. **throws BadRequestException for invalid ObjectId values**  
    Verifies invalid id rejection.

87. **converts arrays of ids**  
    Verifies batch id conversion.

88. **normalizes ids to strings from common populated shapes**  
    Verifies string serialization from strings, `ObjectId`s, populated objects, null, and undefined values.

### `test/unit/common/pagination-interceptors.spec.ts`

89. **wraps page-based pagination responses**  
    Verifies conversion from service pagination shape to `{ data, meta }`.

90. **wraps cursor-based pagination responses**  
    Verifies conversion from cursor pagination shape to `{ data, meta }`.

### `test/unit/system/storage-key.util.spec.ts`

91. **builds the canonical PDF storage key**  
    Verifies the document PDF storage-key format: `documents/{workspaceId}/{documentId}.pdf`.

## Reliability Notes

- Tests use real service/controller/guard classes, but external systems are mocked.
- No test connects to MongoDB, Redis, BullMQ, SMTP, websocket servers, or filesystem storage.
- The suite verifies both successful behavior and failure behavior.
- Mocks make the tests deterministic and fast.
- The tests live outside production source files under `test/unit`, keeping them independent from implementation files.

