import { RedisService } from '../../../src/modules-system/redis/redis.service'

describe('RedisService', () => {
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    eval: jest.fn(),
    getdel: jest.fn(),
  }

  const service = () => new RedisService(redis as any)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sets values with and without ttl', async () => {
    await service().set('plain', 'value')
    await service().set('ttl', 'value', 60)

    expect(redis.set).toHaveBeenNthCalledWith(1, 'plain', 'value')
    expect(redis.set).toHaveBeenNthCalledWith(2, 'ttl', 'value', 'EX', 60)
  })

  it('uses native getdel when available', async () => {
    redis.getdel.mockResolvedValue('value')

    await expect(service().getDel('key')).resolves.toBe('value')
    expect(redis.getdel).toHaveBeenCalledWith('key')
    expect(redis.eval).not.toHaveBeenCalled()
  })

  it('falls back to eval when getdel is not available', async () => {
    const redisWithoutGetDel = { ...redis, getdel: undefined }
    redis.eval.mockResolvedValue('value')

    await expect(new RedisService(redisWithoutGetDel as any).getDel('key')).resolves.toBe('value')
    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining('redis.call'), 1, 'key')
  })

  it('returns null from getDel fallback for non-string redis responses', async () => {
    const redisWithoutGetDel = { ...redis, getdel: undefined }
    redis.eval.mockResolvedValue(1)

    await expect(new RedisService(redisWithoutGetDel as any).getDel('key')).resolves.toBeNull()
  })

  it('serializes and parses JSON helpers', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ ok: true }))
    redis.getdel.mockResolvedValue(JSON.stringify({ deleted: true }))

    await service().setJson('json', { ok: true }, 10)

    expect(redis.set).toHaveBeenCalledWith('json', '{"ok":true}', 'EX', 10)
    await expect(service().getJson('json')).resolves.toEqual({ ok: true })
    await expect(service().getDelJson('json')).resolves.toEqual({ deleted: true })
  })
})

