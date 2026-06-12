import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules-api/auth/auth.module';
import { WorkspaceModule } from './modules-api/workspace/workspace.module';
import { DocumentModule } from './modules-api/document/document.module';
import { CommentModule } from './modules-api/comment/comment.module';
import { UploadModule } from './modules-api/upload/upload.module';
import { ActivityModule } from './modules-api/activity/activity.module';
import { SearchModule } from './modules-api/search/search.module';
import { TokenModule } from './modules-system/token/token.module';
import { MongoDbModule } from './modules-system/mongodb/mongodb.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ProtectGuard } from './common/guards/protect.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { EmailModule } from './modules-system/email/email.module';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from './modules-system/redis/redis.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis';
import { REDIS_HOST, REDIS_PORT } from './common/constants/app.constants';
import { PermissionsModule } from './modules-system/permissions/permissions.module';
import { StorageModule } from './modules-system/storage/storage.module';
import { WebsocketModule } from './modules-system/websocket/websocket.module';

@Module({
  imports: [AuthModule,
            WorkspaceModule, 
            DocumentModule, 
            CommentModule, 
            UploadModule, 
            ActivityModule, 
            SearchModule, 
            TokenModule,
            MongoDbModule,
            EmailModule,
            BullModule.forRoot({
              connection: {
                host: 'localhost',
                port: 6380,
              },
            }),
            RedisModule,
            CacheModule.registerAsync({
              isGlobal: true,
              useFactory: () => ({
                store: redisStore,
                host: REDIS_HOST,
                port: REDIS_PORT,
              })
            }),
            PermissionsModule,
            StorageModule,
            WebsocketModule
          ],
  controllers: [AppController],
  providers: [AppService,
    {
      provide: APP_GUARD,
      useClass: ProtectGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor
    }
  ],
})
export class AppModule {}
