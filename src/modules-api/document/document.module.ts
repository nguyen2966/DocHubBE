import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { PermissionsModule } from 'src/modules-system/permissions/permissions.module';
import { PermissionsService } from 'src/modules-system/permissions/permissions.service';
import { BullModule } from '@nestjs/bullmq';
import { DocumentProcessor } from './document.processor';

@Module({
  imports:[
    PermissionsModule,
    BullModule.registerQueue({
      name: 'document-processing',
    }),
    PermissionsModule
  ],
  controllers: [DocumentController],
  providers: [DocumentService,PermissionsService, DocumentProcessor, PermissionsService ],
  
})
export class DocumentModule {}
