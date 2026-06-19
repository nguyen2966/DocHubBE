import { Controller, Get, Query, Req, UseInterceptors } from '@nestjs/common'
import { type Request } from 'express'
import { PagePaginationResponseInterceptor } from 'src/common/interceptors/page-paginated.interceptor'
import { SearchDocumentsQueryDto } from './dto/search-documents-query.dto'
import { DocumentSearchService } from './document-search.service'

@Controller('documents/search')
export class DocumentSearchController {
  constructor(private readonly documentSearchService: DocumentSearchService) {}

  @Get()
  @UseInterceptors(PagePaginationResponseInterceptor)
  searchDocuments(
    @Req() req: Request,
    @Query() query: SearchDocumentsQueryDto,
  ) {
    return this.documentSearchService.searchDocuments(
      req.user!._id.toString(),
      query,
    )
  }

  @Get('workspaces')
  getWorkspaceFilterOptions(@Req() req: Request) {
    return this.documentSearchService.getWorkspaceFilterOptions(
      req.user!._id.toString(),
    )
  }
}
