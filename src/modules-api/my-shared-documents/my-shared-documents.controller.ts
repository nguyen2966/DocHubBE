import { Controller } from '@nestjs/common';
import { MySharedDocumentsService } from './my-shared-documents.service';
import { Req, Get, Param } from '@nestjs/common';

@Controller('shared-with-me')
export class MySharedDocumentController {
  constructor(private readonly shareDocumentService: MySharedDocumentsService) { }

  @Get('documents')
  getSharedWithMeDocuments(@Req() req: any) {
    return this.shareDocumentService.getSharedWithMeDocuments(
      req.user._id.toString(),
    );
  }

  @Get('documents/:documentId')
  getSharedWithMeDocumentDetail(
    @Req() req: any,
    @Param('documentId') documentId: string,
  ) {
    return this.shareDocumentService.getSharedWithMeDocumentDetail(
      req.user._id.toString(),
      documentId,
    );
  }
}