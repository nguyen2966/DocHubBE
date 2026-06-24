import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules-api/auth/auth.module';
import { WorkspaceModule } from './modules-api/workspace/workspace.module';
import { DocumentModule } from './modules-api/document/document.module';
import { CommentModule } from './modules-api/comment/comment.module';
import { ActivityModule } from './modules-api/activity/activity.module';
import { SearchModule } from './modules-api/search/search.module';
import { TokenModule } from './modules-system/token/token.module';
import { MongoDbModule } from './modules-system/mongodb/mongodb.module';
import { APP_GUARD } from '@nestjs/core';
import { ProtectGuard } from './common/guards/protect.guard';


@Module({
  imports: [AuthModule,
            WorkspaceModule, 
            DocumentModule, 
            CommentModule, 
            ActivityModule, 
            SearchModule, 
            TokenModule,
            MongoDbModule
          ],
  controllers: [AppController],
  providers: [AppService,
    {
      provide: APP_GUARD,
      useClass: ProtectGuard
    },
  ],
})
export class AppModule {}
