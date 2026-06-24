import { SetMetadata } from "@nestjs/common";

export const RequireWorkspacePermission = (...permissions: string[]) => SetMetadata('workspace_permissions', permissions);