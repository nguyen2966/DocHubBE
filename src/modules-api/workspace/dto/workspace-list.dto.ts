import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class WorkspaceListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}
