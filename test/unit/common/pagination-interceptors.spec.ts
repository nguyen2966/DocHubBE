import { firstValueFrom } from 'rxjs'
import { PagePaginationResponseInterceptor } from '../../../src/common/interceptors/page-paginated.interceptor'
import { PaginationResponseInterceptor } from '../../../src/common/interceptors/paginated.interceptor'
import { createCallHandler } from '../helpers'

describe('pagination interceptors', () => {
  it('wraps page-based pagination responses', async () => {
    const interceptor = new PagePaginationResponseInterceptor()
    const next = createCallHandler({
      items: [{ id: 1 }],
      page: 2,
      limit: 10,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    })

    await expect(firstValueFrom(interceptor.intercept({} as any, next))).resolves.toEqual({
      data: [{ id: 1 }],
      meta: {
        page: 2,
        limit: 10,
        totalItems: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    })
  })

  it('wraps cursor-based pagination responses', async () => {
    const interceptor = new PaginationResponseInterceptor()
    const next = createCallHandler({
      items: ['a'],
      nextCursor: 'next',
      hasMore: true,
    })

    await expect(firstValueFrom(interceptor.intercept({} as any, next))).resolves.toEqual({
      data: ['a'],
      meta: {
        nextCursor: 'next',
        hasMore: true,
      },
    })
  })
})

