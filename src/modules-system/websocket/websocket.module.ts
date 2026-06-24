// src/modules-system/websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { ProgressGateway } from './progress.gateway';

@Module({
  providers: [ProgressGateway],
  exports: [ProgressGateway],   // export để các module khác inject được
})
export class WebsocketModule {}