jest.mock('uuid', () => ({
  v4: jest.fn(() => 'job-uuid'),
}))

import { UploadJobService } from '../../../src/modules-api/document/upload-job.service'

describe('UploadJobService', () => {
  const jobModel = {
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  }
  const wsGateway = {
    emitProgress: jest.fn(),
  }

  const service = () => new UploadJobService(jobModel as any, wsGateway as any)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates an upload job and returns the generated id', async () => {
    await expect(service().create('workspace-1')).resolves.toBe('job-uuid')

    expect(jobModel.create).toHaveBeenCalledWith({
      jobId: 'job-uuid',
      workspaceId: 'workspace-1',
      status: 'UPLOADING',
      progress: 0,
    })
  })

  it('returns null and emits nothing when update target is missing', async () => {
    jobModel.findOneAndUpdate.mockResolvedValue(null)

    await expect(service().update('job-1', { progress: 33 })).resolves.toBeNull()
    expect(wsGateway.emitProgress).not.toHaveBeenCalled()
  })

  it('updates a job and emits progress payload', async () => {
    const job = {
      workspaceId: 'workspace-1',
      jobId: 'job-1',
      status: 'EXTRACTING',
      progress: 66,
      documentId: 'doc-1',
      errorMessage: undefined,
    }
    jobModel.findOneAndUpdate.mockResolvedValue(job)

    await expect(service().update('job-1', { progress: 66 })).resolves.toBe(job)

    expect(jobModel.findOneAndUpdate).toHaveBeenCalledWith(
      { jobId: 'job-1' },
      expect.objectContaining({ progress: 66, updatedAt: expect.any(Date) }),
      { returnDocument: 'after' },
    )
    expect(wsGateway.emitProgress).toHaveBeenCalledWith('workspace-1', {
      jobId: 'job-1',
      status: 'EXTRACTING',
      progress: 66,
      documentId: 'doc-1',
      errorMessage: undefined,
    })
  })
})

