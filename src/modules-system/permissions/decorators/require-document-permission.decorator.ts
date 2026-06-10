// src/modules-system/permissions/decorators/document-permissions.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const DOCUMENT_PERMISSIONS_KEY = 'document_permissions'
export const RequireDocumentPermissions = (...permissions: string[]) =>
  SetMetadata(DOCUMENT_PERMISSIONS_KEY, permissions)