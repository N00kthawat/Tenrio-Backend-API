import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [AuthModule, HealthModule, OrganizationsModule, CatalogModule],
})
export class AppModule {}
