import { Module } from '@nestjs/common'
import { DocumentSearchController } from './document-search.controller'
import { DocumentSearchService } from './document-search.service'

@Module({
  controllers: [DocumentSearchController],
  providers: [DocumentSearchService],
})
export class DocumentSearchModule {}
