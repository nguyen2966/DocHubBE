import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { UploadJobStatus } from '../mongodb/schemas/upload-job';

interface ProgressPayload {
  jobId: string;
  status: UploadJobStatus;
  progress: number;           // 0–100
  documentId?: string;        // có sau khi document record được tạo
  errorMessage?: string;      // có khi status = FAILED
}

@WebSocketGateway({ cors: true, namespace: '/progress' })
export class ProgressGateway {
  @WebSocketServer() server!: Server;

  // Client join vào room theo workspaceId khi mở trang
  @SubscribeMessage('join-workspace')
  handleJoin(@MessageBody() workspaceId: string, @ConnectedSocket() client: Socket) {
    client.join(`workspace:${workspaceId}`);
  }

  emitProgress(workspaceId: string, payload: ProgressPayload) {
    this.server.to(`workspace:${workspaceId}`).emit('job:progress', payload);
  }
}