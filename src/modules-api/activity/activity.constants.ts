export const ACTIVITY_ACTION = {
  CREATE_DOCUMENT: 'create_document',
  UPDATE_DOCUMENT: 'update_document',
  DELETE_DOCUMENT: 'delete_document',
  SHARE_DOCUMENT: 'share_document',
  REVOKE_ACCESS: 'revoke_access',
  INVITE_USER: 'invite_user',
  REMOVE_USER: 'remove_user',
  CHANGE_USER_ROLE: 'change_user_role',
  UPDATE_SETTINGS: 'update_settings',
  WORKSPACE_CREATION: 'workspace_creation',
} as const

export const ACTIVITY_TARGET = {
  DOCUMENT: 'document',
  WORKSPACE: 'workspace',
  MEMBER: 'member',
} as const

export type ActivityAction =
  (typeof ACTIVITY_ACTION)[keyof typeof ACTIVITY_ACTION]

export type ActivityTarget =
  (typeof ACTIVITY_TARGET)[keyof typeof ACTIVITY_TARGET]
