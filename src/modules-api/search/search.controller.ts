import { Controller, Get, Post, Body, Patch, Param, Delete, Req } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchUserByEmailDto } from './dto/search-user-email.dto';
import { Query } from '@nestjs/common';



@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('search')
  searchByEmail(@Query() dto: SearchUserByEmailDto) {
    return this.searchService.searchByEmail(dto.email, dto.workspaceId);
  }
}
