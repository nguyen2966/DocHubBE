jest.mock('../../../src/modules-api/activity/activity.service', () => ({
  ActivityService: class ActivityService {},
}))
jest.mock('../../../src/modules-api/search/search.service', () => ({
  SearchService: class SearchService {},
}))
jest.mock('../../../src/modules-api/document-search/document-search.service', () => ({
  DocumentSearchService: class DocumentSearchService {},
}))
jest.mock('../../../src/modules-api/my-shared-documents/my-shared-documents.service', () => ({
  MySharedDocumentsService: class MySharedDocumentsService {},
}))

import { ActivityController } from '../../../src/modules-api/activity/activity.controller'
import { SearchController } from '../../../src/modules-api/search/search.controller'
import { DocumentSearchController } from '../../../src/modules-api/document-search/document-search.controller'
import { MySharedDocumentController } from '../../../src/modules-api/my-shared-documents/my-shared-documents.controller'

describe('remaining API controllers', () => {
  const req = { user: { _id: { toString: () => 'user-1' } } }

  it('ActivityController delegates list and actor lookup', async () => {
    const service = {
      findActorsByWorkspace: jest.fn().mockResolvedValue(['actor']),
      findByWorkspace: jest.fn(),
    }
    const controller = new ActivityController(service as any)

    await expect(controller.findActors('workspace-1')).resolves.toEqual({ data: ['actor'] })
    controller.findByWorkspace('workspace-1', { page: 1 } as any)

    expect(service.findActorsByWorkspace).toHaveBeenCalledWith('workspace-1')
    expect(service.findByWorkspace).toHaveBeenCalledWith('workspace-1', { page: 1 })
  })

  it('SearchController delegates email search', () => {
    const service = { searchByEmail: jest.fn() }
    const controller = new SearchController(service as any)

    controller.searchByEmail({ email: 'u@example.com', workspaceId: 'workspace-1' })

    expect(service.searchByEmail).toHaveBeenCalledWith('u@example.com', 'workspace-1')
  })

  it('DocumentSearchController delegates search endpoints with user id', () => {
    const service = {
      searchDocuments: jest.fn(),
      getWorkspaceFilterOptions: jest.fn(),
    }
    const controller = new DocumentSearchController(service as any)

    controller.searchDocuments(req as any, { q: 'term' } as any)
    controller.getWorkspaceFilterOptions(req as any)

    expect(service.searchDocuments).toHaveBeenCalledWith('user-1', { q: 'term' })
    expect(service.getWorkspaceFilterOptions).toHaveBeenCalledWith('user-1')
  })

  it('MySharedDocumentController delegates list and detail endpoints', () => {
    const service = {
      getSharedWithMeDocuments: jest.fn(),
      getSharedWithMeDocumentDetail: jest.fn(),
    }
    const controller = new MySharedDocumentController(service as any)

    controller.getSharedWithMeDocuments(req, { page: 1 } as any)
    controller.getSharedWithMeDocumentDetail(req, 'doc-1')

    expect(service.getSharedWithMeDocuments).toHaveBeenCalledWith('user-1', { page: 1 })
    expect(service.getSharedWithMeDocumentDetail).toHaveBeenCalledWith('user-1', 'doc-1')
  })
})

