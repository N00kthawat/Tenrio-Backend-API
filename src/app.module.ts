import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';

@Module({
  imports: [AuthModule, HealthModule, OrganizationsModule],
})
export class AppModule {}
