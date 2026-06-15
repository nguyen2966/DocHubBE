import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

import { ACTIVITY_TARGET } from '../activity.constants'
import type { ActivityTarget } from '../activity.constants'

export class ActivityLogQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number

  @IsOptional()
  @IsString()
  actionTypes?: string

  @IsOptional()
  @IsMongoId()
  actorId?: string

  @IsOptional()
  @IsIn(Object.values(ACTIVITY_TARGET))
  targetType?: ActivityTarget
}
