import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { PermissionsModule } from '../../modules-system/permissions/permissions.module'

@Module({
  imports: [PermissionsModule],
  controllers: [CommentController],
  providers: [CommentService],
})
export class CommentModule {}
