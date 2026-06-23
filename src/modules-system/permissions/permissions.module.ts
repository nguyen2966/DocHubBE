import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';


@Module({
  exports: [PermissionsService],
  providers: [PermissionsService],
})
export class PermissionsModule {}
