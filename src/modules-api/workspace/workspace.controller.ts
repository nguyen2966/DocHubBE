import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { type Request, type Response } from 'express'
import { WorkspaceService } from './workspace.service'
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { APP_CLIENT_URL } from 'src/common/constants/app.constants';
import { InvitationAction } from 'src/common/constants/enum';
import { OptionalAuth } from 'src/common/decorators/optional-auth.decorator';
import { RequireWorkspacePermission } from 'src/modules-system/permissions/decorators/require-workspace-permission.decorator';
import { WorkspacePermissionGuard } from 'src/modules-system/permissions/guards/workspace-permission.guard';
import { PagePaginationResponseInterceptor } from 'src/common/interceptors/page-paginated.interceptor';
import { WorkspaceListQueryDto } from './dto/workspace-list.dto';

@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) { }


  /**
  * Entry point từ email — PUBLIC, browser GET khi user click link.
  *
  * Registered user:
  *   - Nếu đang đăng nhập (cookie hợp lệ): add vào workspace → redirect Document list
  *   - Nếu chưa đăng nhập: redirect FE login page kèm ?next=/invitations/:token/accept
  *     để sau khi login, FE gọi POST /api/workspaces/invitations/:token/accept
  *
  * Unregistered user:
  *   - redirect FE sign-up page kèm ?invitationToken=:token
  *   - Sau khi sign-up + verify email, claimPendingInvitations() tự add vào workspace
  */
  @Get('invitations/:token/accept')
  @OptionalAuth()
  async handleInvitationLink(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId =
      (req as any).user?._id?.toString();

    const result =
      await this.workspaceService.handleInvitationLink(
        token,
        userId,
      );

    switch (result.action) {
      case InvitationAction.INVALID:
        return res.redirect(
          `${APP_CLIENT_URL}/invitations/invalid`,
        );

      case InvitationAction.SIGN_UP:
        return res.redirect(
          `${APP_CLIENT_URL}/signup?invitationToken=${result.token}`,
        );

      case InvitationAction.SIGN_IN:
        return res.redirect(
          `${APP_CLIENT_URL}/invitations/${result.token}/accept`,
        );

      case InvitationAction.VERIFY_REQUIRED:
        return res.redirect(
          `${APP_CLIENT_URL}/verify-email?email=${encodeURIComponent(result.email ?? '')}&reason=verify_required`,
        );

      case InvitationAction.ACCEPTED:
        return res.redirect(
          `${APP_CLIENT_URL}/workspaces/${result.workspaceId}/documents`,
        );
    }
  }

  @Post('invitations/:token/accept-authenticated')
  @HttpCode(HttpStatus.OK)
  acceptInvitationAuthenticated(
    @Req() req: Request,
    @Param('token') token: string,
  ) {
    return this.workspaceService.acceptInvitation(
      token,
      req.user!._id.toString(),
    )
  }

  /**
   * Registered user đã đăng nhập gọi để complete accept.
   * FE gọi sau khi: login xong (từ redirect) hoặc đang đăng nhập sẵn nhưng cần confirm qua API.
   */
  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  acceptInvitation(@Req() req: Request, @Param('token') token: string) {
    return this.workspaceService.acceptInvitation(token, req.user!._id.toString())
  }

  // ─── Workspace CRUD ───────────────────────────────────────

  @Post()
  create(@Req() req: Request, @Body() dto: CreateWorkspaceDto) {
    return this.workspaceService.create(req.user!._id.toString(), dto)
  }

  @Get()
  @UseInterceptors(PagePaginationResponseInterceptor)
  findAll(
    @Req() req: Request,
    @Query() query: WorkspaceListQueryDto,
  ) {
    return this.workspaceService.findAllByUser(
      req.user!._id.toString(),
      query,
    )
  }

  @Get(':workspaceId')
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission('workspace:view')
  findOne(@Req() req: Request, @Param('workspaceId') workspaceId: string) {
    return this.workspaceService.findOne(workspaceId, req.user!._id.toString())
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission('workspace:manage_settings')
  update(
    @Req() req: Request,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.update(workspaceId, req.user!._id.toString(), dto)
  }

  @Delete(':workspaceId')
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission('workspace:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('workspaceId') workspaceId: string) {
    return this.workspaceService.remove(workspaceId, req.user!._id.toString())
  }

  // ─── Members ──────────────────────────────────────────────

  @Get(':workspaceId/members')
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission('workspace:view')
  getMembers(@Req() req: Request, @Param('workspaceId') workspaceId: string) {
    return this.workspaceService.getMembers(workspaceId, req.user!._id.toString())
  }

  @Patch(':workspaceId/members/:userId/role')
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission('workspace:change_member_role')
  updateMemberRole(
    @Req() req: Request,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspaceService.updateMemberRole(
      workspaceId,
      targetUserId,
      req.user!._id.toString(),
      dto,
    )
  }

  @Delete(':workspaceId/members/:userId')
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission('workspace:remove_member')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Req() req: Request,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.workspaceService.removeMember(
      workspaceId,
      targetUserId,
      req.user!._id.toString(),
    )
  }

  @Post(':workspaceId/members/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  leaveWorkspace(@Req() req: Request, @Param('workspaceId') workspaceId: string) {
    return this.workspaceService.leaveWorkspace(workspaceId, req.user!._id.toString())
  }

  // ─── Invitations ──────────────────────────────────────────

  @Post(':workspaceId/invitations')
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission('workspace:invite_member')
  @HttpCode(HttpStatus.CREATED)
  inviteMember(
    @Req() req: Request,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteMemberDto,           // dto.emails: string[]
  ) {
    return this.workspaceService.inviteMember(
      workspaceId,
      req.user!._id.toString(),
      dto,
    )
  }

  @Get(':workspaceId/invitations')
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission('workspace:invite_member')
  getInvitations(@Req() req: Request, @Param('workspaceId') workspaceId: string) {
    return this.workspaceService.getInvitations(workspaceId, req.user!._id.toString())
  }

  @Delete(':workspaceId/invitations/:invitationId')
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission('workspace:invite_member')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelInvitation(
    @Req() req: Request,
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.workspaceService.cancelInvitation(
      workspaceId,
      invitationId,
      req.user!._id.toString(),
    )
  }

}
