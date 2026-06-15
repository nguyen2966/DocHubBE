import { BadRequestException } from '@nestjs/common'
import { Types } from 'mongoose'

export function toObjectId(value: string | Types.ObjectId): Types.ObjectId {
  if (value instanceof Types.ObjectId) {
    return value
  }

  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException(`Invalid ObjectId: ${value}`)
  }

  return new Types.ObjectId(value)
}

export function toObjectIds(
  values: Array<string | Types.ObjectId>,
): Types.ObjectId[] {
  return values.map(toObjectId)
}

export function toStringId(
  value: string | Types.ObjectId | { _id: unknown } | null | undefined,
): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Types.ObjectId) {
    return value.toString()
  }

  return toStringId(value._id as string | Types.ObjectId | null | undefined)
}
