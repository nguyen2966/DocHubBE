import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

interface PagePaginatedResult<T> {
  items: T[]
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

@Injectable()
export class PagePaginationResponseInterceptor<T>
  implements NestInterceptor<PagePaginatedResult<T>, any>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    return next.handle().pipe(
      map((result: PagePaginatedResult<T>) => ({
        data: result.items,
        meta: {
          page: result.page,
          limit: result.limit,
          totalItems: result.totalItems,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        },
      })),
    )
  }
}
