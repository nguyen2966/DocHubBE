import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common'
import { WorkspacePermissionGuard } from '../../../src/modules-system/permissions/guards/workspace-permission.guard'
import { DocumentPermissionGuard } from '../../../src/modules-system/permissions/guards/document-permission.guard'
import { createHttpContext } from '../helpers'

describe('permission guards', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  }
  const permissionsService = {
    canWorkspace: jest.fn(),
    canDocument: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('WorkspacePermissionGuard', () => {
    const guard = () =>
      new WorkspacePermissionGuard(reflector as any, permissionsService as any)

    it('allows handlers without required permissions', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined)

      await expect(guard().canActivate(createHttpContext({}))).resolves.toBe(true)
    })

    it('requires an authenticated user', async () => {
      reflector.getAllAndOverride.mockReturnValue(['workspace:view'])

      await expect(guard().canActivate(createHttpContext({ params: {} }))).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('requires workspaceId route param', async () => {
      reflector.getAllAndOverride.mockReturnValue(['workspace:view'])

      await expect(
        guard().canActivate(createHttpContext({ user: { _id: 'user-1' }, params: {} })),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects when any required workspace permission is denied', async () => {
      reflector.getAllAndOverride.mockReturnValue(['workspace:view', 'workspace:delete'])
      permissionsService.canWorkspace.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

      await expect(
        guard().canActivate(
          createHttpContext({
            user: { _id: { toString: () => 'user-1' } },
            params: { workspaceId: 'workspace-1' },
          }),
        ),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('DocumentPermissionGuard', () => {
    const guard = () =>
      new DocumentPermissionGuard(reflector as any, permissionsService as any)

    it('allows when all document permissions pass', async () => {
      reflector.getAllAndOverride.mockReturnValue(['document:view'])
      permissionsService.canDocument.mockResolvedValue(true)

      await expect(
        guard().canActivate(
          createHttpContext({
            user: { _id: { toString: () => 'user-1' } },
            params: { workspaceId: 'workspace-1', documentId: 'document-1' },
          }),
        ),
      ).resolves.toBe(true)
    })

    it('requires documentId route param', async () => {
      reflector.getAllAndOverride.mockReturnValue(['document:view'])

      await expect(
        guard().canActivate(
          createHttpContext({
            user: { _id: { toString: () => 'user-1' } },
            params: { workspaceId: 'workspace-1' },
          }),
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })
})

