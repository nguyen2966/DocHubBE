import { Module } from '@nestjs/common';
import { ShareDocumentService } from './share-document.service';
import { ShareDocumentController } from './share-document.controller';
import { PermissionsModule } from 'src/modules-system/permissions/permissions.module';
import { PermissionsService } from 'src/modules-system/permissions/permissions.service';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [PermissionsModule, ActivityModule],
  controllers: [ShareDocumentController],
  providers: [ShareDocumentService, PermissionsService],
})
export class ShareDocumentModule {}
