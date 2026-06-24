jest.mock('../../../src/modules-api/share-document/share-document.service', () => ({
  ShareDocumentService: class ShareDocumentService {},
}))

import {
  DocumentShareInvitationController,
  ShareDocumentController,
} from '../../../src/modules-api/share-document/share-document.controller'

describe('ShareDocument controllers', () => {
  const shareDocumentService = {
    getDocumentAccess: jest.fn(),
    searchUsersWithContext: jest.fn(),
    shareDocument: jest.fn(),
    updateRole: jest.fn(),
    removeAccess: jest.fn(),
    updatePendingShareRole: jest.fn(),
    removePendingShare: jest.fn(),
    resolveShareToken: jest.fn(),
    acceptShareToken: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('delegates document access management endpoints', () => {
    const controller = new ShareDocumentController(shareDocumentService as any)
    const req = { user: { _id: { toString: () => 'actor-1' } } }

    controller.getAccess('doc-1', 'workspace-1')
    controller.searchUsers('doc-1', 'workspace-1', undefined, 'q')
    controller.share('doc-1', 'workspace-1', { emails: ['a@example.com'] } as any, req)
    controller.updateRole('doc-1', 'workspace-1', 'user-1', { role: 'viewer' } as any, req)
    controller.removeAccess('workspace-1', 'doc-1', 'user-1', req)

    expect(shareDocumentService.getDocumentAccess).toHaveBeenCalledWith(
      'doc-1',
      'workspace-1',
    )
    expect(shareDocumentService.searchUsersWithContext).toHaveBeenCalledWith(
      'doc-1',
      'workspace-1',
      'q',
    )
    expect(shareDocumentService.shareDocument).toHaveBeenCalledWith(
      'doc-1',
      'workspace-1',
      'actor-1',
      { emails: ['a@example.com'] },
    )
    expect(shareDocumentService.updateRole).toHaveBeenCalledWith(
      'doc-1',
      'workspace-1',
      'user-1',
      'actor-1',
      { role: 'viewer' },
    )
    expect(shareDocumentService.removeAccess).toHaveBeenCalledWith(
      'doc-1',
      'workspace-1',
      'user-1',
      'actor-1',
    )
  })

  it('delegates share invitation endpoints', () => {
    const controller = new DocumentShareInvitationController(shareDocumentService as any)
    const req = { user: { _id: { toString: () => 'user-1' } } }

    controller.resolve('token-1')
    controller.accept('token-1', req)

    expect(shareDocumentService.resolveShareToken).toHaveBeenCalledWith('token-1')
    expect(shareDocumentService.acceptShareToken).toHaveBeenCalledWith('token-1', 'user-1')
  })
})

