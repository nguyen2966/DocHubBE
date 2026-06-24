import { BadRequestException } from '@nestjs/common'
import { Types } from 'mongoose'
import {
  toObjectId,
  toObjectIds,
  toStringId,
} from '../../../src/common/utils/mongo-id.util'

describe('mongo-id.util', () => {
  it('converts a valid string into an ObjectId', () => {
    const id = '507f1f77bcf86cd799439011'

    expect(toObjectId(id)).toBeInstanceOf(Types.ObjectId)
    expect(toObjectId(id).toString()).toBe(id)
  })

  it('returns an existing ObjectId unchanged', () => {
    const id = new Types.ObjectId()

    expect(toObjectId(id)).toBe(id)
  })

  it('throws BadRequestException for invalid ObjectId values', () => {
    expect(() => toObjectId('not-an-id')).toThrow(BadRequestException)
  })

  it('converts arrays of ids', () => {
    const ids = ['507f1f77bcf86cd799439011', new Types.ObjectId()]

    expect(toObjectIds(ids).map((id) => id.toString())).toEqual([
      ids[0],
      ids[1].toString(),
    ])
  })

  it('normalizes ids to strings from common populated shapes', () => {
    const id = new Types.ObjectId()

    expect(toStringId(id)).toBe(id.toString())
    expect(toStringId(id.toString())).toBe(id.toString())
    expect(toStringId({ _id: id })).toBe(id.toString())
    expect(toStringId(null)).toBe('')
  })
})

