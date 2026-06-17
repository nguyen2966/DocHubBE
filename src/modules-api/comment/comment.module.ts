import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { PermissionsService } from '../../modules-system/permissions/permissions.service';

@Module({
  controllers: [CommentController],
  providers: [CommentService, PermissionsService],
})
export class CommentModule {}
