import { Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [EmailModule, PrismaModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
