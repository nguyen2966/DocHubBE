import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { PermissionsModule } from 'src/modules-system/permissions/permissions.module';
import { PermissionsService } from 'src/modules-system/permissions/permissions.service';

@Module({
  imports:[PermissionsModule],
  controllers: [DocumentController],
  providers: [DocumentService,PermissionsService ],
})
export class DocumentModule {}
