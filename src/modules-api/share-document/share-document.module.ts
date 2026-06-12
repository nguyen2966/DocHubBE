import { Module } from '@nestjs/common';
import { ShareDocumentService } from './share-document.service';
import { ShareDocumentController } from './share-document.controller';

@Module({
  controllers: [ShareDocumentController],
  providers: [ShareDocumentService],
})
export class ShareDocumentModule {}
