import { Type } from 'class-transformer'
import {
  IsIn,
  IsDateString,
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 13

  @IsOptional()
  @IsString()
  actionTypes?: string

  @IsOptional()
  @IsMongoId()
  actorId?: string

  @IsOptional()
  @IsIn(Object.values(ACTIVITY_TARGET))
  targetType?: ActivityTarget

  @IsOptional()
  @IsDateString()
  from?: string

  @IsOptional()
  @IsDateString()
  to?: string
}
