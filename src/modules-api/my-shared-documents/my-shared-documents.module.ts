import { Module } from '@nestjs/common';
import { MySharedDocumentsService } from './my-shared-documents.service';
import { MySharedDocumentController } from './my-shared-documents.controller';
import { PermissionsModule } from 'src/modules-system/permissions/permissions.module';

@Module({
  imports:[PermissionsModule],
  controllers: [MySharedDocumentController],
  providers: [MySharedDocumentsService],
})
export class MySharedDocumentsModule {}
