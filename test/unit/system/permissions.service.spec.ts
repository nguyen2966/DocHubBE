import { Types } from 'mongoose'
import { PermissionsService } from '../../../src/modules-system/permissions/permissions.service'
import { createQueryMock } from '../helpers'

describe('PermissionsService', () => {
  const workspaceMemberModel = {
    findOne: jest.fn(),
  }
  const documentPermissionModel = {
    findOne: jest.fn(),
    find: jest.fn(),
  }

  const service = () =>
    new PermissionsService(workspaceMemberModel as any, documentPermissionModel as any)

  const userId = new Types.ObjectId().toString()
  const workspaceId = new Types.ObjectId().toString()
  const documentId = new Types.ObjectId().toString()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('denies workspace permissions without membership', async () => {
    workspaceMemberModel.findOne.mockReturnValue(createQueryMock(null))

    await expect(service().canWorkspace(userId, workspaceId, 'workspace:view')).resolves.toBe(
      false,
    )
  })

  it('allows workspace permissions from role map', async () => {
    workspaceMemberModel.findOne.mockReturnValue(
      createQueryMock({ roleId: { name: 'admin' } }),
    )

    await expect(service().canWorkspace(userId, workspaceId, 'workspace:delete')).resolves.toBe(
      true,
    )
  })

  it('allows explicit document roles when the role includes the permission', async () => {
    documentPermissionModel.findOne.mockReturnValue(createQueryMock({ role: 'editor' }))
    workspaceMemberModel.findOne.mockReturnValue(createQueryMock(null))

    await expect(
      service().canDocument(userId, workspaceId, documentId, 'document:edit'),
    ).resolves.toBe(true)
  })

  it('does not allow owner document role without workspace membership', async () => {
    documentPermissionModel.findOne.mockReturnValue(createQueryMock({ role: 'owner' }))
    workspaceMemberModel.findOne.mockReturnValue(createQueryMock(null))

    await expect(
      service().canDocument(userId, workspaceId, documentId, 'document:delete'),
    ).resolves.toBe(false)
  })

  it('uses workspace role as implied document role', async () => {
    documentPermissionModel.findOne.mockReturnValue(createQueryMock(null))
    workspaceMemberModel.findOne.mockReturnValue(
      createQueryMock({ roleId: { name: 'member' } }),
    )

    await expect(
      service().canDocument(userId, workspaceId, documentId, 'document:edit'),
    ).resolves.toBe(true)
  })

  it('returns effective owner only when owner is also a workspace member', async () => {
    workspaceMemberModel.findOne.mockReturnValue(
      createQueryMock({ roleId: { name: 'admin' } }),
    )
    documentPermissionModel.findOne.mockReturnValue(createQueryMock({ role: 'owner' }))

    await expect(service().getEffectiveDocumentRole(userId, workspaceId, documentId)).resolves.toBe(
      'owner',
    )
  })

  it('bulk maps final document permissions', async () => {
    const docA = new Types.ObjectId().toString()
    const docB = new Types.ObjectId().toString()

    workspaceMemberModel.findOne.mockReturnValue(
      createQueryMock({ roleId: { name: 'member' } }),
    )
    documentPermissionModel.find.mockReturnValue(
      createQueryMock([{ documentId: docA, role: 'owner' }]),
    )

    await expect(
      service().getBulkDocumentPermissions(userId, workspaceId, [docA, docB]),
    ).resolves.toMatchObject({
      [docA]: expect.arrayContaining(['document:manage_access']),
      [docB]: expect.arrayContaining(['document:edit']),
    })
  })

  it('returns no available document permissions when there is no effective role', async () => {
    workspaceMemberModel.findOne.mockReturnValue(createQueryMock(null))
    documentPermissionModel.findOne.mockReturnValue(createQueryMock(null))

    await expect(
      service().getAvailableDocumentPermissions(userId, workspaceId, documentId),
    ).resolves.toEqual([])
  })
})

