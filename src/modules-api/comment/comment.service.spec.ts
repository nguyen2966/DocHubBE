import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CommentService } from './comment.service';
import { Annotation } from '../../modules-system/mongodb/schemas/annotation';
import { Comment } from '../../modules-system/mongodb/schemas/comment';
import { Document } from '../../modules-system/mongodb/schemas/document';
import { PermissionsService } from '../../modules-system/permissions/permissions.service';

describe('CommentService', () => {
  let service: CommentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: getModelToken(Annotation.name), useValue: {} },
        { provide: getModelToken(Comment.name), useValue: {} },
        { provide: getModelToken(Document.name), useValue: {} },
        { provide: PermissionsService, useValue: {} },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
