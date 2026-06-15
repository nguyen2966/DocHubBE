import { Module } from '@nestjs/common';
import { MySharedDocumentsService } from './my-shared-documents.service';
import { MySharedDocumentController } from './my-shared-documents.controller';

@Module({
  controllers: [MySharedDocumentController],
  providers: [MySharedDocumentsService],
})
export class MySharedDocumentsModule {}
