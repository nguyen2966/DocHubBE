import { Global, Module, OnModuleInit } from '@nestjs/common';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { MONGO_URL } from 'src/common/constants/app.constants';
import { User, UserSchema } from './schemas/users';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-tokens';
import { Role, RoleSchema } from './schemas/role';
import { WorkspaceInvitation, WorkspaceInvitationSchema } from './schemas/workspace-ivitation';
import { Workspace, WorkspaceSchema } from './schemas/workspace';
import { WorkspaceMember, WorkspaceMemberSchema } from './schemas/workspace-member';

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(MONGO_URL as string),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: WorkspaceMember.name, schema: WorkspaceMemberSchema },
      { name: WorkspaceInvitation.name, schema: WorkspaceInvitationSchema },
    ])
  ],
  exports: [MongooseModule],
})
export class MongoDbModule implements OnModuleInit {
  constructor(@InjectConnection() private connection: Connection) { }

  async onModuleInit() {
    try {
      console.log(`[LOG] MongoDB connection state: ${this.connection.readyState ? "OK" : "Failed"} `);
    } catch (err) {
      console.log(err);
    }
  }
}