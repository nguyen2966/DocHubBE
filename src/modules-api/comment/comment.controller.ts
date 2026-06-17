import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'

import { DocumentPermissionGuard } from '../../modules-system/permissions/guards/document-permission.guard'
import { RequireDocumentPermissions } from '../../modules-system/permissions/decorators/require-document-permission.decorator'
import { CommentService } from './comment.service'
import {
  CreateCommentDto,
  CreateCommentThreadDto,
} from './dto/create-comment.dto'
import { UpdateCommentDto } from './dto/update-comment.dto'

@ApiTags('Comments')
@ApiParam({
  name: 'workspaceId',
  example: '665f1234567890abcdef0001',
  description: 'Workspace id that owns the document.',
})
@ApiParam({
  name: 'documentId',
  example: '665f1234567890abcdef0002',
  description: 'Document id containing the comment thread.',
})
@Controller('workspaces/:workspaceId/documents/:documentId')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get('comment-threads')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:view')
  @ApiOperation({
    summary: 'List comment threads',
    description:
      'Returns active annotation threads for a document with active comments nested under each thread.',
  })
  @ApiOkResponse({
    description: 'Active comment threads for the document.',
  })
  getThreads(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.commentService.getThreads(workspaceId, documentId)
  }

  @Post('comment-threads')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:comment')
  @ApiOperation({
    summary: 'Create a comment thread',
    description:
      'Creates a document annotation anchor and the root comment for a new thread.',
  })
  @ApiBody({
    type: CreateCommentThreadDto,
    examples: {
      pointMarker: {
        summary: 'Create a point marker thread',
        value: {
          pageNumber: 1,
          position: { x: 180, y: 240 },
          xfdf: null,
          apryseAnnotationId: null,
          content: 'This paragraph needs a clearer explanation.',
        },
      },
      highlight: {
        summary: 'Create a highlighted thread',
        value: {
          pageNumber: 1,
          position: { x: 180, y: 240 },
          xfdf: '<xfdf>...</xfdf>',
          apryseAnnotationId: 'apryse-annotation-123',
          content: 'This highlighted sentence needs review.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Created annotation thread with its root comment.',
  })
  createThread(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Body() dto: CreateCommentThreadDto,
    @Req() req: any,
  ) {
    return this.commentService.createThread(
      workspaceId,
      documentId,
      req.user._id.toString(),
      dto,
    )
  }

  @Post('annotations/:annotationId/comments')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:comment')
  @ApiOperation({
    summary: 'Add a reply comment',
    description:
      'Adds a comment to an existing annotation thread. Include parentId to create a nested reply.',
  })
  @ApiParam({
    name: 'annotationId',
    example: '665f1234567890abcdef1001',
    description: 'Annotation thread id.',
  })
  @ApiBody({
    type: CreateCommentDto,
    examples: {
      nestedReply: {
        summary: 'Nested reply',
        value: {
          content: 'Agree. I think we should split this sentence.',
          parentId: '665f1234567890abcdef1234',
        },
      },
      topLevelReply: {
        summary: 'Top-level thread reply',
        value: {
          content: 'I added a suggested rewrite below.',
          parentId: null,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Created reply comment.',
  })
  addComment(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('annotationId') annotationId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: any,
  ) {
    return this.commentService.addComment(
      workspaceId,
      documentId,
      annotationId,
      req.user._id.toString(),
      dto,
    )
  }

  @Patch('comments/:commentId')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:view')
  @ApiOperation({
    summary: 'Edit a comment',
    description: 'Updates comment content. The service allows only the author.',
  })
  @ApiParam({
    name: 'commentId',
    example: '665f1234567890abcdef2001',
    description: 'Comment id to edit.',
  })
  @ApiBody({
    type: UpdateCommentDto,
    examples: {
      update: {
        summary: 'Update content',
        value: {
          content: 'Updated comment content.',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Updated comment.',
  })
  updateComment(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @Req() req: any,
  ) {
    return this.commentService.updateComment(
      workspaceId,
      documentId,
      commentId,
      req.user._id.toString(),
      dto,
    )
  }

  @Delete('comments/:commentId')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:view')
  @ApiOperation({
    summary: 'Soft delete a comment',
    description:
      'Soft deletes a comment. The service allows the author or a document manager.',
  })
  @ApiParam({
    name: 'commentId',
    example: '665f1234567890abcdef2001',
    description: 'Comment id to soft delete.',
  })
  @ApiOkResponse({
    description: 'Delete result. Current response shape is { deleted: true }.',
  })
  deleteComment(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    return this.commentService.deleteComment(
      workspaceId,
      documentId,
      commentId,
      req.user._id.toString(),
    )
  }

  @Patch('annotations/:annotationId/resolve')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:comment')
  @ApiOperation({
    summary: 'Resolve a comment thread',
    description: 'Marks an annotation thread as resolved.',
  })
  @ApiParam({
    name: 'annotationId',
    example: '665f1234567890abcdef1001',
    description: 'Annotation thread id to resolve.',
  })
  @ApiOkResponse({
    description: 'Resolved annotation thread.',
  })
  resolveThread(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('annotationId') annotationId: string,
    @Req() req: any,
  ) {
    return this.commentService.resolveThread(
      workspaceId,
      documentId,
      annotationId,
      req.user._id.toString(),
    )
  }

  @Patch('annotations/:annotationId/reopen')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:comment')
  @ApiOperation({
    summary: 'Reopen a comment thread',
    description: 'Marks a resolved annotation thread as open again.',
  })
  @ApiParam({
    name: 'annotationId',
    example: '665f1234567890abcdef1001',
    description: 'Annotation thread id to reopen.',
  })
  @ApiOkResponse({
    description: 'Reopened annotation thread.',
  })
  reopenThread(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('annotationId') annotationId: string,
  ) {
    return this.commentService.reopenThread(
      workspaceId,
      documentId,
      annotationId,
    )
  }

  @Delete('annotations/:annotationId')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:view')
  @ApiOperation({
    summary: 'Soft delete a comment thread',
    description:
      'Soft deletes the annotation thread and its related active comments.',
  })
  @ApiParam({
    name: 'annotationId',
    example: '665f1234567890abcdef1001',
    description: 'Annotation thread id to soft delete.',
  })
  @ApiOkResponse({
    description: 'Delete result. Current response shape is { deleted: true }.',
  })
  deleteThread(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('annotationId') annotationId: string,
    @Req() req: any,
  ) {
    return this.commentService.deleteThread(
      workspaceId,
      documentId,
      annotationId,
      req.user._id.toString(),
    )
  }
}
