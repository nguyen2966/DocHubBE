jest.mock('../../../src/modules-api/workspace/workspace.service', () => ({
  WorkspaceService: class WorkspaceService {},
}))

import { InvitationAction } from '../../../src/common/constants/enum'
import { WorkspaceController } from '../../../src/modules-api/workspace/workspace.controller'
import { createResponseMock } from '../helpers'

describe('WorkspaceController', () => {
  const workspaceService = {
    handleInvitationLink: jest.fn(),
    acceptInvitation: jest.fn(),
    create: jest.fn(),
    findAllByUser: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getMembers: jest.fn(),
    updateMemberRole: jest.fn(),
    removeMember: jest.fn(),
    leaveWorkspace: jest.fn(),
    inviteMember: jest.fn(),
    getInvitations: jest.fn(),
    cancelInvitation: jest.fn(),
  }

  const controller = () => new WorkspaceController(workspaceService as any)
  const req = { user: { _id: { toString: () => 'user-1' } } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('delegates workspace CRUD operations with authenticated user id', () => {
    controller().create(req as any, { name: 'Workspace' })
    controller().findAll(req as any, { page: 2 } as any)
    controller().findOne(req as any, 'workspace-1')
    controller().update(req as any, 'workspace-1', { name: 'New' })

    expect(workspaceService.create).toHaveBeenCalledWith('user-1', { name: 'Workspace' })
    expect(workspaceService.findAllByUser).toHaveBeenCalledWith('user-1', { page: 2 })
    expect(workspaceService.findOne).toHaveBeenCalledWith('workspace-1', 'user-1')
    expect(workspaceService.update).toHaveBeenCalledWith('workspace-1', 'user-1', {
      name: 'New',
    })
  })

  it('delegates member and invitation operations', () => {
    controller().updateMemberRole(req as any, 'workspace-1', 'target-1', { role: 'admin' })
    controller().removeMember(req as any, 'workspace-1', 'target-1')
    controller().leaveWorkspace(req as any, 'workspace-1')
    controller().inviteMember(req as any, 'workspace-1', {
      emails: ['a@example.com'],
      role: 'member',
    })
    controller().cancelInvitation(req as any, 'workspace-1', 'invite-1')

    expect(workspaceService.updateMemberRole).toHaveBeenCalledWith(
      'workspace-1',
      'target-1',
      'user-1',
      { role: 'admin' },
    )
    expect(workspaceService.removeMember).toHaveBeenCalledWith(
      'workspace-1',
      'target-1',
      'user-1',
    )
    expect(workspaceService.leaveWorkspace).toHaveBeenCalledWith('workspace-1', 'user-1')
    expect(workspaceService.inviteMember).toHaveBeenCalledWith('workspace-1', 'user-1', {
      emails: ['a@example.com'],
      role: 'member',
    })
    expect(workspaceService.cancelInvitation).toHaveBeenCalledWith(
      'workspace-1',
      'invite-1',
      'user-1',
    )
  })

  it.each([
    [InvitationAction.INVALID, '/invitations/invalid'],
    [InvitationAction.SIGN_UP, '/signup?invitationToken=token-1'],
    [InvitationAction.SIGN_IN, '/invitations/token-1/accept'],
    [InvitationAction.ACCEPTED, '/workspaces/workspace-1/documents'],
  ])('redirects invitation action %s', async (action, expectedPath) => {
    workspaceService.handleInvitationLink.mockResolvedValue({
      action,
      token: 'token-1',
      workspaceId: 'workspace-1',
    })
    const res = createResponseMock()

    await controller().handleInvitationLink('token-1', req as any, res as any)

    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining(expectedPath))
  })
})

