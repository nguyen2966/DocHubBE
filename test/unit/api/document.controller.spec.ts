import { BadRequestException } from '@nestjs/common'
import { DocumentController } from '../../../src/modules-api/document/document.controller'

describe('DocumentController', () => {
  const documentService = {
    createMarkdown: jest.fn(),
    uploadPdf: jest.fn(),
    cancelUpload: jest.fn(),
    editPdf: jest.fn(),
    findByWorkspace: jest.fn(),
    findById: jest.fn(),
    rename: jest.fn(),
    delete: jest.fn(),
    getMembers: jest.fn(),
  }
  const permissionsService = {
    getBulkDocumentPermissions: jest.fn(),
    getAvailableDocumentPermissions: jest.fn(),
  }
  const uploadJobService = {
    create: jest.fn(),
  }

  const controller = () =>
    new DocumentController(
      documentService as any,
      permissionsService as any,
      uploadJobService as any,
    )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects non-markdown source type on create endpoint', () => {
    expect(() =>
      controller().createMarkdown(
        'workspace-1',
        { sourceType: 'file_upload' } as any,
        { user: { _id: { toString: () => 'user-1' } } },
      ),
    ).toThrow(BadRequestException)
  })

  it('delegates markdown creation with workspace and user ids', () => {
    const dto = { sourceType: 'md_editor', title: 'Doc', markdownContent: '# Hi' }
    documentService.createMarkdown.mockReturnValue({ _id: 'doc-1' })

    expect(
      controller().createMarkdown('workspace-1', dto as any, {
        user: { _id: { toString: () => 'user-1' } },
      }),
    ).toEqual({ _id: 'doc-1' })
    expect(documentService.createMarkdown).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      dto,
    )
  })

  it('requires file and jobId for PDF upload', async () => {
    await expect(
      controller().uploadPdf('workspace-1', undefined as any, { jobId: 'job-1' } as any, {}),
    ).rejects.toThrow('File is required')

    await expect(
      controller().uploadPdf(
        'workspace-1',
        { originalname: 'doc.pdf' } as any,
        {} as any,
        {},
      ),
    ).rejects.toThrow('jobId is required')
  })

  it('uses original PDF filename as title when upload title is omitted', async () => {
    const file = {
      originalname: 'Report.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('pdf'),
      size: 3,
    } as any
    const req = { user: { _id: { toString: () => 'user-1' } } }
    documentService.uploadPdf.mockResolvedValue({ _id: 'doc-1' })

    await controller().uploadPdf('workspace-1', file, { jobId: 'job-1' } as any, req)

    expect(documentService.uploadPdf).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      file,
      'Report',
      'job-1',
    )
  })

  it('adds bulk permissions to document list responses', async () => {
    const doc = { _id: { toString: () => 'doc-1' }, title: 'Doc' }
    documentService.findByWorkspace.mockResolvedValue({
      items: [doc],
      page: 1,
      limit: 12,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    })
    permissionsService.getBulkDocumentPermissions.mockResolvedValue({
      'doc-1': ['document:view'],
    })

    await expect(
      controller().findAll(
        'workspace-1',
        { user: { _id: { toString: () => 'user-1' } } } as any,
        {},
      ),
    ).resolves.toMatchObject({
      items: [{ title: 'Doc', permissions: ['document:view'] }],
    })
  })
})

