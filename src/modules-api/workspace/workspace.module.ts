import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { EmailModule } from 'src/modules-system/email/email.module';
import { OptionalAuthGuard } from 'src/common/guards/option.guard';
import { TokenModule } from 'src/modules-system/token/token.module';
import { PermissionsModule } from 'src/modules-system/permissions/permissions.module';
import { PermissionsService } from 'src/modules-system/permissions/permissions.service';

@Module({
  imports:[EmailModule, TokenModule, PermissionsModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, OptionalAuthGuard, PermissionsService],
})
export class WorkspaceModule {}
