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

    console.log('controller handler hit')
    console.log('req.user:', (req as any).user)
    console.log('req.cookies:', req.cookies)

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

      case InvitationAction.ACCEPTED:
        return res.redirect(
          `${APP_CLIENT_URL}/workspaces/${result.workspaceId}`,
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
  findAll(@Req() req: Request) {
    return this.workspaceService.findAllByUser(req.user!._id.toString())
  }

  @Get(':workspaceId')
  findOne(@Req() req: Request, @Param('workspaceId') workspaceId: string) {
    return this.workspaceService.findOne(workspaceId, req.user!._id.toString())
  }

  @Patch(':workspaceId')
  update(
    @Req() req: Request,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.update(workspaceId, req.user!._id.toString(), dto)
  }

  @Delete(':workspaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('workspaceId') workspaceId: string) {
    return this.workspaceService.remove(workspaceId, req.user!._id.toString())
  }

  // ─── Members ──────────────────────────────────────────────

  @Get(':workspaceId/members')
  getMembers(@Req() req: Request, @Param('workspaceId') workspaceId: string) {
    return this.workspaceService.getMembers(workspaceId, req.user!._id.toString())
  }

  @Patch(':workspaceId/members/:userId/role')
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
  inviteMember(
    @Req() req: Request,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspaceService.inviteMember(
      workspaceId,
      req.user!._id.toString(),
      dto,
    )
  }

  @Get(':workspaceId/invitations')
  getInvitations(@Req() req: Request, @Param('workspaceId') workspaceId: string) {
    return this.workspaceService.getInvitations(workspaceId, req.user!._id.toString())
  }

  @Delete(':workspaceId/invitations/:invitationId')
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