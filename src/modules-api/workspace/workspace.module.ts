import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { EmailModule } from 'src/modules-system/email/email.module';
import { OptionalAuthGuard } from 'src/common/guards/option.guard';
import { TokenModule } from 'src/modules-system/token/token.module';

@Module({
  imports:[EmailModule, TokenModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, OptionalAuthGuard],
})
export class WorkspaceModule {}
