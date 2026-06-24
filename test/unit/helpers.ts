import { ExecutionContext } from '@nestjs/common'
import { of } from 'rxjs'

export function createQueryMock<T = unknown>(value: T) {
  const query: any = {
    select: jest.fn(() => query),
    populate: jest.fn(() => query),
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    lean: jest.fn(() => Promise.resolve(value)),
    exec: jest.fn(() => Promise.resolve(value)),
  }

  return query
}

export function createMutableDocument<T extends Record<string, any>>(
  value: T,
) {
  return {
    ...value,
    save: jest.fn().mockResolvedValue(value),
    populate: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn(() => ({ ...value })),
  }
}

export function createHttpContext(request: any): ExecutionContext {
  return {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => request),
    })),
  } as any
}

export function createCallHandler(value: unknown) {
  return {
    handle: jest.fn(() => of(value)),
  }
}

export function createResponseMock() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  }
}

