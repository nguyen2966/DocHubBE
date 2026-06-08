import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';


@Module({
  exports: [PermissionsModule],
  providers: [PermissionsService],
})
export class PermissionsModule {}
