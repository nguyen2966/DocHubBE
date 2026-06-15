import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'

import { PaginationResponseInterceptor } from 'src/common/interceptors/paginated.interceptor'
import { RequireWorkspacePermission } from 'src/modules-system/permissions/decorators/require-workspace-permission.decorator'
import { WorkspacePermissionGuard } from 'src/modules-system/permissions/guards/workspace-permission.guard'
import { ActivityService } from './activity.service'
import { ActivityLogQueryDto } from './dto/activity-log-query.dto'

@Controller('workspaces/:workspaceId/activity-logs')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission('workspace:view_activity_log')
  @UseInterceptors(PaginationResponseInterceptor)
  findByWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Query() query: ActivityLogQueryDto,
  ) {
    return this.activityService.findByWorkspace(workspaceId, query)
  }
}
