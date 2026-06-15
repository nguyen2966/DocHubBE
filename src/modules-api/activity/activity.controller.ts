import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'

import { PagePaginationResponseInterceptor } from 'src/common/interceptors/page-paginated.interceptor'
import { RequireWorkspacePermission } from 'src/modules-system/permissions/decorators/require-workspace-permission.decorator'
import { WorkspacePermissionGuard } from 'src/modules-system/permissions/guards/workspace-permission.guard'
import { ActivityService } from './activity.service'
import { ActivityLogQueryDto } from './dto/activity-log-query.dto'

@Controller('workspaces/:workspaceId/activity-logs')
@UseGuards(WorkspacePermissionGuard)
@RequireWorkspacePermission('workspace:view_activity_log')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('actors')
  async findActors(@Param('workspaceId') workspaceId: string) {
    return {
      data: await this.activityService.findActorsByWorkspace(workspaceId),
    }
  }

  @Get()
  @UseInterceptors(PagePaginationResponseInterceptor)
  findByWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Query() query: ActivityLogQueryDto,
  ) {
    return this.activityService.findByWorkspace(workspaceId, query)
  }
}
