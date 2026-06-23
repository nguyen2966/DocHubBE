import { Controller } from '@nestjs/common';
import { MySharedDocumentsService } from './my-shared-documents.service';
import { Req, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { PagePaginationResponseInterceptor } from 'src/common/interceptors/page-paginated.interceptor';
import { SharedWithMeDocumentsQueryDto } from './dto/shared-with-me-documents-query.dto';

@Controller('shared-with-me')
export class MySharedDocumentController {
  constructor(private readonly shareDocumentService: MySharedDocumentsService) { }

  @Get('documents')
  @UseInterceptors(PagePaginationResponseInterceptor)
  getSharedWithMeDocuments(
    @Req() req: any,
    @Query() query: SharedWithMeDocumentsQueryDto,
  ) {
    return this.shareDocumentService.getSharedWithMeDocuments(
      req.user._id.toString(),
      query,
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
