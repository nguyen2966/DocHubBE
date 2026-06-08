import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsMongoId, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class CursorPaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  cursor?: string

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}