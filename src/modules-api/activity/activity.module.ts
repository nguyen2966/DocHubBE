import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';
import { PermissionsModule } from 'src/modules-system/permissions/permissions.module';
import { PermissionsService } from 'src/modules-system/permissions/permissions.service';

@Module({
  imports: [PermissionsModule],
  controllers: [ActivityController],
  providers: [ActivityService, PermissionsService],
  exports: [ActivityService],
})
export class ActivityModule {}
