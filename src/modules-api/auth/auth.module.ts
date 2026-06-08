import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenModule } from 'src/modules-system/token/token.module';
import { EmailModule } from 'src/modules-system/email/email.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { WorkspaceService } from '../workspace/workspace.service';

@Module({
  imports: [TokenModule, EmailModule, WorkspaceModule],
  controllers: [AuthController],
  providers: [AuthService, WorkspaceService],
})
export class AuthModule {}
