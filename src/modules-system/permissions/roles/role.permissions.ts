// src/modules-system/permissions/roles/role.permissions.ts

export const WORKSPACE_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'workspace:view',
    'workspace:create_document',
    'workspace:manage_settings',
    'workspace:invite_member',
    'workspace:remove_member',
    'workspace:change_member_role',
    'workspace:delete',
    'workspace:view_activity_log',
  ],
  member: [
    'workspace:view',
    'workspace:create_document',
  ],
}

export const DOCUMENT_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    'document:view',
    'document:edit',
    'document:delete',
    'document:rename',
    'document:manage_access',
    'document:comment',
  ],
  editor: [
    'document:view',
    'document:edit',
    'document:comment',
  ],
  commenter: [
    'document:view',
    'document:comment',
  ],
  viewer: [
    'document:view',
  ],
}

export const WORKSPACE_ROLE_TO_DOCUMENT_ROLE: Record<string, string> = {
  admin: 'owner',
  member: 'editor',
}