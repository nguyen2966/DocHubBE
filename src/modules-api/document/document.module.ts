import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { PermissionsModule } from 'src/modules-system/permissions/permissions.module';
import { PermissionsService } from 'src/modules-system/permissions/permissions.service';
import { BullModule } from '@nestjs/bullmq';
import { DocumentProcessor } from './document.processor';
import { StorageModule } from 'src/modules-system/storage/storage.module';
import { UploadJobService } from './upload-job.service';
import { WebsocketModule } from 'src/modules-system/websocket/websocket.module';
import { ProgressGateway } from 'src/modules-system/websocket/progress.gateway';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports:[
    PermissionsModule,
    BullModule.registerQueue({
      name: 'document-processing',
    }),
    PermissionsModule,
    StorageModule,
    WebsocketModule,
    ActivityModule,
  ],
  controllers: [DocumentController],
  providers: [DocumentService,
              PermissionsService, 
              DocumentProcessor, 
              PermissionsService, 
              UploadJobService,
             ],
  
})
export class DocumentModule {}
