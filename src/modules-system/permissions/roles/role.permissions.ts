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