# FOLIO

## Permission Model

### 1. Overview

#### Goal

The permission model defines what a user can do in the application.

FOLIO separates access control into two scopes:

```txt
Workspace-level permission
Document-level permission
```

Workspace-level permission controls actions that affect the whole workspace, such as creating documents, inviting members, changing member roles, managing workspace settings, viewing activity logs, or deleting the workspace.

Document-level permission controls actions on a specific document, such as viewing, editing, commenting, deleting, renaming, or managing document access.

This separation keeps the system flexible. A user can be a normal workspace member but still have a stronger role on one specific document. Another user can be outside the workspace but still be invited to collaborate on one document.

---

### 2. Permission Scope

#### Workspace Scope

Workspace permissions apply to the workspace as a whole.

Examples:

```txt
View workspace
Create document
Invite member
Remove member
Change member role
Manage workspace settings
Delete workspace
View activity log
```

Workspace permissions are resolved from the user's workspace membership.

#### Document Scope

Document permissions apply to one document only.

Examples:

```txt
View document
Edit document
Comment on document
Rename document
Delete document
Manage document access
```

Document permissions can come from two sources:

```txt
Workspace membership
Explicit document permission
```

Workspace membership gives the user default access to documents inside that workspace. Explicit document permission is used when a document is shared directly with a specific user.

---

### 3. Workspace Roles

#### Goal

Workspace roles define what a user can do inside a workspace.

The app currently uses two workspace roles:

```txt
admin
member
```

---

#### Admin

A workspace admin has full management access inside the workspace.

Admin permissions:

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

An admin can:

```txt
View the workspace
Create documents
Manage workspace settings
Invite members
Remove members
Change member roles
Delete the workspace
View workspace activity logs
```

Admin is the highest workspace role, so it should be assigned carefully.

---

#### Member

A workspace member has basic collaboration access.

Member permissions:

```txt
workspace:view
workspace:create_document
```

A member can:

```txt
View the workspace
Create documents
```

A member cannot:

```txt
Invite other members
Remove members
Change member roles
Manage workspace settings
Delete the workspace
View activity logs
```

---

### 4. Workspace Permission Check

#### Goal

The backend must verify that a user has the required workspace permission before allowing a workspace action.

#### Flow

When a workspace-protected request is received, the backend checks:

```txt
1. Is the user authenticated?
2. Is the user an active member of this workspace?
3. What is the user's workspace role?
4. Does that role include the required permission?
```

A valid workspace membership should match:

```txt
workspaceId
userId
isDeleted = false
```

If no active membership exists, the user has no workspace access.

#### Example: Invite Member

```txt
User wants to invite another member
Required permission: workspace:invite_member

If user role = admin:
  Allow

If user role = member:
  Deny
```

#### Example: Create Document

```txt
User wants to create a document
Required permission: workspace:create_document

If user role = admin:
  Allow

If user role = member:
  Allow

If user is not a workspace member:
  Deny
```

---

### 5. Document Roles

#### Goal

Document roles define what a user can do on a specific document.

The app currently uses four document roles:

```txt
owner
editor
commenter
viewer
```

---

#### Owner

The document owner has full control over the document.

Owner permissions:

```txt
document:view
document:edit
document:delete
document:rename
document:manage_access
document:comment
```

An owner can:

```txt
View the document
Edit the document
Comment on the document
Rename the document
Delete the document
Manage document access
```

---

#### Editor

The editor can work on document content.

Editor permissions:

```txt
document:view
document:edit
document:comment
```

An editor can:

```txt
View the document
Edit the document
Comment on the document
```

An editor cannot:

```txt
Delete the document
Rename the document
Manage document access
```

---

#### Commenter

The commenter can participate in discussion but cannot edit document content.

Commenter permissions:

```txt
document:view
document:comment
```

A commenter can:

```txt
View the document
Comment on the document
```

A commenter cannot:

```txt
Edit the document
Rename the document
Delete the document
Manage document access
```

---

#### Viewer

The viewer has read-only access.

Viewer permissions:

```txt
document:view
```

A viewer can:

```txt
View the document
```

A viewer cannot:

```txt
Edit the document
Comment on the document
Rename the document
Delete the document
Manage document access
```

---

### 6. Workspace Role to Document Role Mapping

#### Goal

Workspace membership gives users default access to documents inside the workspace.

The app maps workspace roles to document roles:

```txt
workspace admin  -> document owner
workspace member -> document editor
```

This means workspace users do not need to be manually granted access to every document.

#### Workspace Admin

A workspace admin is treated like a document owner for documents in that workspace.

```txt
workspace role = admin
implied document role = owner
```

So the admin can:

```txt
View documents
Edit documents
Comment on documents
Rename documents
Delete documents
Manage document access
```

#### Workspace Member

A workspace member is treated like a document editor for documents in that workspace.

```txt
workspace role = member
implied document role = editor
```

So the member can:

```txt
View documents
Edit documents
Comment on documents
```

But the member cannot:

```txt
Delete documents
Rename documents
Manage document access
```

---

### 7. Explicit Document Permission

#### Goal

Explicit document permission is used when a document is shared directly with a user.

This is useful when:

```txt
A user is outside the workspace
A document owner wants to share only one document
A specific user needs a specific role on a document
```

An explicit document permission stores:

```txt
documentId
userId
role
grantedBy
```

The explicit role can be:

```txt
owner
editor
commenter
viewer
```

However, in normal sharing flow, external users should usually receive one of these roles:

```txt
editor
commenter
viewer
```

Owner-level access should stay inside the workspace boundary.

---

### 8. Effective Document Permission

#### Goal

Effective document permission is the final permission result used by the backend.

A user's final document access can come from:

```txt
Workspace membership
Explicit document permission
```

#### Resolution Idea

The backend should allow an action if at least one valid permission source grants the required permission.

```txt
If workspace role grants the permission:
  Allow

Else if explicit document role grants the permission:
  Allow

Else:
  Deny
```

This makes document access flexible.

#### Example: Workspace Member With No Explicit Permission

```txt
User is a workspace member
Workspace member maps to document editor

Effective document role:
  editor

Allowed:
  document:view
  document:edit
  document:comment
```

#### Example: External Viewer

```txt
User is not a workspace member
User has explicit document role = viewer

Effective document role:
  viewer

Allowed:
  document:view

Denied:
  document:edit
  document:comment
  document:manage_access
  document:delete
```

#### Example: External Commenter

```txt
User is not a workspace member
User has explicit document role = commenter

Allowed:
  document:view
  document:comment

Denied:
  document:edit
  document:manage_access
  document:delete
```

---

### 9. Permission Priority

#### Goal

Permission priority explains how the system behaves when a user has more than one possible permission source.

The practical priority is:

```txt
1. Workspace admin access
2. Document owner access
3. Workspace member access
4. Explicit document permission
5. Deny
```

#### Workspace Admin

Workspace admin has broad access and is treated as document owner inside the workspace.

```txt
workspace admin -> document owner
```

This gives the admin strong control over workspace documents.

#### Workspace Member

Workspace member has default editor access to workspace documents.

```txt
workspace member -> document editor
```

This means members can collaborate on documents without being manually added to each document.

#### Explicit Document Permission

Explicit document permission is mainly used for direct sharing.

It is especially important for external users because they do not have workspace membership.

---

### 10. Important Trade-off

#### Workspace Access Is Broad

Because workspace membership gives default document access, a workspace member can access documents in the workspace according to the role mapping.

For example:

```txt
workspace member -> document editor
```

This is simple and convenient, but it means per-document restriction for workspace members is limited.

#### Explicit Lower Role Does Not Necessarily Reduce Workspace Access

If a user is already a workspace member, assigning a lower explicit document role should not be used as a reliable way to reduce their workspace-based access.

Example:

```txt
User is workspace member
Workspace role gives editor access

Even if explicit document role is viewer,
the workspace role still grants editor-level access.
```

To restrict a user from workspace documents, the correct action is to change or remove their workspace membership, not only assign a lower document role.

---

### 11. External User Access

#### Goal

External access allows collaboration with users who are not members of the workspace.

External users can be granted access to one document without joining the whole workspace.

Example:

```txt
External user receives viewer role on Document A
```

The user can:

```txt
View Document A
```

The user cannot:

```txt
View workspace documents list
Access Document B
Invite workspace members
Manage workspace settings
Delete the workspace
```

This keeps workspace-level access separate from document-level sharing.

#### External Access Summary

```txt
Workspace member:
  Access is scoped to the workspace

External document user:
  Access is scoped to one document
```

---

### 12. Permission Check Examples

#### View Workspace

Required permission:

```txt
workspace:view
```

Allowed:

```txt
admin
member
```

Denied:

```txt
non-member
external document user
```

---

#### Create Document

Required permission:

```txt
workspace:create_document
```

Allowed:

```txt
admin
member
```

Denied:

```txt
non-member
external document user
```

---

#### Invite Workspace Member

Required permission:

```txt
workspace:invite_member
```

Allowed:

```txt
admin
```

Denied:

```txt
member
non-member
external document user
```

---

#### Manage Workspace Settings

Required permission:

```txt
workspace:manage_settings
```

Allowed:

```txt
admin
```

Denied:

```txt
member
non-member
external document user
```

---

#### View Document

Required permission:

```txt
document:view
```

Allowed:

```txt
workspace admin
workspace member
document owner
document editor
document commenter
document viewer
```

Denied:

```txt
non-member without explicit document permission
```

---

#### Edit Document

Required permission:

```txt
document:edit
```

Allowed:

```txt
workspace admin
workspace member
document owner
document editor
```

Denied:

```txt
commenter
viewer
non-shared external user
```

---

#### Comment on Document

Required permission:

```txt
document:comment
```

Allowed:

```txt
workspace admin
workspace member
document owner
document editor
document commenter
```

Denied:

```txt
viewer
non-shared external user
```

---

#### Manage Document Access

Required permission:

```txt
document:manage_access
```

Allowed:

```txt
workspace admin
document owner
```

Denied:

```txt
workspace member
editor
commenter
viewer
external user without owner-level access
```

---

#### Delete Document

Required permission:

```txt
document:delete
```

Allowed:

```txt
workspace admin
document owner
```

Denied:

```txt
workspace member
editor
commenter
viewer
external user
```

---

### 13. Data Model

#### Workspace Member

Workspace membership connects a user to a workspace.

Main fields:

```txt
workspaceId
userId
roleId
invitedBy
joinedAt
isDeleted
deletedAt
deletedBy
```

The permission system should only consider active memberships.

```txt
isDeleted = false
```

Soft-deleted or removed memberships should not grant permissions.

---

#### Document Permission

Document permission connects a user to a document.

Main fields:

```txt
documentId
userId
role
grantedBy
```

A document permission represents direct access to one document.

A user should only have one explicit permission record per document.

---

### 14. Backend Enforcement

#### Goal

The backend is the source of truth for permission checks.

Frontend permission checks are only used to improve user experience. They can hide buttons or disable actions, but they are not enough for security.

Every sensitive backend action must check permission again.

#### Examples

```txt
Create workspace:
  requires authenticated user

View workspace:
  requires workspace:view

Create document:
  requires workspace:create_document

Invite member:
  requires workspace:invite_member

Remove member:
  requires workspace:remove_member

Change member role:
  requires workspace:change_member_role

Delete workspace:
  requires workspace:delete

View document:
  requires document:view

Edit document:
  requires document:edit

Comment document:
  requires document:comment

Share document:
  requires document:manage_access

Delete document:
  requires document:delete
```

If the user does not have the required permission, the backend should reject the request.

---

### 15. Frontend Usage

#### Goal

The frontend uses permissions to decide what actions should be visible or enabled.

Example UI behavior:

```txt
document:view:
  allow opening the document

document:edit:
  show Edit PDF button

document:comment:
  show comment panel and comment tools

document:manage_access:
  show Share button

document:rename:
  show Rename action

document:delete:
  show Delete action

workspace:invite_member:
  show Invite Member button

workspace:manage_settings:
  show Workspace Settings
```

The frontend should never assume that hidden buttons are enough for security.

All final decisions must still be enforced by the backend.

---

### 16. Design Benefits

#### Clear Scope Separation

Workspace permissions protect workspace-level actions.

Document permissions protect document-level actions.

This prevents workspace management logic from being mixed with document collaboration logic.

#### Easy Internal Collaboration

Workspace members automatically get default document access through role mapping.

```txt
workspace admin  -> document owner
workspace member -> document editor
```

This reduces the need to manually share every document with every workspace member.

#### Safe External Sharing

External users can be invited to one document without gaining access to the whole workspace.

This supports document collaboration while keeping workspace data protected.

#### Flexible Access Control

The system supports both:

```txt
Workspace-based collaboration
Document-level sharing
```

This makes the permission model flexible enough for common collaboration workflows.

---

### 17. Limitations

#### Per-document Restriction for Workspace Members Is Limited

Since workspace membership gives default document access, lowering a user's explicit document role does not fully restrict them if their workspace role still grants access.

To restrict workspace-level access, update the workspace membership.

#### Workspace Admin Has Broad Power

Workspace admin maps to document owner, so admins have strong permissions across documents in the workspace.

This is convenient for management, but admin role should be assigned carefully.

#### External Owner Should Be Avoided

External users should generally be shared as:

```txt
viewer
commenter
editor
```

Owner-level access should remain tied to workspace membership and workspace ownership rules.

---

### 18. Summary

#### Workspace Roles

```txt
admin:
  workspace:view
  workspace:create_document
  workspace:manage_settings
  workspace:invite_member
  workspace:remove_member
  workspace:change_member_role
  workspace:delete
  workspace:view_activity_log

member:
  workspace:view
  workspace:create_document
```

#### Document Roles

```txt
owner:
  document:view
  document:edit
  document:delete
  document:rename
  document:manage_access
  document:comment

editor:
  document:view
  document:edit
  document:comment

commenter:
  document:view
  document:comment

viewer:
  document:view
```

#### Role Mapping

```txt
workspace admin  -> document owner
workspace member -> document editor
```

#### Final Rule

```txt
Workspace permissions protect workspace actions.
Document permissions protect document actions.
Workspace role gives default document access.
Explicit document permission gives direct per-document access.
Backend is always the source of truth.
```
