import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { map } from 'rxjs/operators'
import { Observable } from 'rxjs'

interface PaginatedResult<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

@Injectable()
export class PaginationResponseInterceptor<T>
  implements NestInterceptor<PaginatedResult<T>, any>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    return next.handle().pipe(
      map((result: PaginatedResult<T>) => {
        return {
          data: result.items,
          meta: {
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
          },
        }
      }),
    )
  }
}