import { buildDocumentKey } from '../../../src/modules-system/storage/storage-key.util'

describe('buildDocumentKey', () => {
  it('builds the canonical PDF storage key', () => {
    expect(buildDocumentKey('workspace-1', 'document-1').replace(/\\/g, '/')).toBe(
      'documents/workspace-1/document-1.pdf',
    )
  })
})

