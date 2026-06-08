export type PaginatedResponse<T> = {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}