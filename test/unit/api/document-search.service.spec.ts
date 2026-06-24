import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { Types } from 'mongoose'
import { DocumentSearchService } from '../../../src/modules-api/document-search/document-search.service'
import { createQueryMock } from '../helpers'

describe('DocumentSearchService', () => {
  const documentModel = {
    find: jest.fn(),
    countDocuments: jest.fn(),
  }
  const memberModel = {
    find: jest.fn(),
  }
  const documentPermissionModel = {
    find: jest.fn(),
  }

  const service = () =>
    new DocumentSearchService(
      documentModel as any,
      memberModel as any,
      documentPermissionModel as any,
    )

  const userId = new Types.ObjectId().toString()
  const workspaceId = new Types.ObjectId()
  const directDocId = new Types.ObjectId()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('searches accessible documents and maps workspace access results', async () => {
    const documentId = new Types.ObjectId()
    memberModel.find.mockReturnValueOnce(
      createQueryMock([{ workspaceId }]),
    )
    documentPermissionModel.find.mockReturnValueOnce(
      createQueryMock([{ documentId: directDocId, role: 'viewer' }]),
    )
    documentModel.find.mockReturnValue(
      createQueryMock([
        {
          _id: documentId,
          title: 'Quarterly Report',
          workspaceId: { _id: workspaceId, name: 'Workspace' },
          sourceType: 'file_upload',
          extractedTextPreview:
            'Intro text before the important budget section and more text after.',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    )
    documentModel.countDocuments.mockResolvedValue(1)

    await expect(
      service().searchDocuments(userId, { q: 'budget', limit: 100 }),
    ).resolves.toMatchObject({
      page: 1,
      limit: 50,
      totalItems: 1,
      items: [
        {
          documentId: documentId.toString(),
          title: 'Quarterly Report',
          workspace: {
            workspaceId: workspaceId.toString(),
            name: 'Workspace',
          },
          accessType: 'workspace',
          previewText: expect.stringContaining('budget'),
        },
      ],
    })

    expect(documentModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: 'processed',
        $text: expect.objectContaining({ $search: 'budget' }),
      }),
      { score: { $meta: 'textScore' } },
    )
  })

  it('rejects workspace filters outside the user membership scope', async () => {
    memberModel.find.mockReturnValueOnce(createQueryMock([{ workspaceId }]))
    documentPermissionModel.find.mockReturnValueOnce(createQueryMock([]))

    await expect(
      service().searchDocuments(userId, {
        workspaceIds: [new Types.ObjectId().toString()],
      } as any),
    ).rejects.toThrow(ForbiddenException)
  })

  it('rejects invalid updated date filters', async () => {
    memberModel.find.mockReturnValueOnce(createQueryMock([]))
    documentPermissionModel.find.mockReturnValueOnce(createQueryMock([]))

    await expect(
      service().searchDocuments(userId, { updatedFrom: 'not-a-date' } as any),
    ).rejects.toThrow(BadRequestException)
  })

  it('maps workspace filter options from active memberships', async () => {
    const deletedWorkspaceId = new Types.ObjectId()
    memberModel.find.mockReturnValue(
      createQueryMock([
        {
          workspaceId: { _id: workspaceId, name: 'Workspace', isDeleted: false },
          roleId: { name: 'admin' },
        },
        {
          workspaceId: {
            _id: deletedWorkspaceId,
            name: 'Deleted',
            isDeleted: true,
          },
          roleId: { name: 'member' },
        },
      ]),
    )

    await expect(service().getWorkspaceFilterOptions(userId)).resolves.toEqual([
      {
        workspaceId: workspaceId.toString(),
        name: 'Workspace',
        role: 'admin',
      },
    ])
  })
})

