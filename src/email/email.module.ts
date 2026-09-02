import { Module } from '@nestjs/common';

import { EMAIL_PROVIDER } from './email-provider';
import { EmailService } from './email.service';
import { ResendEmailProvider } from './resend-email.provider';

@Module({
  providers: [
    EmailService,
    {
      provide: EMAIL_PROVIDER,
      useClass: ResendEmailProvider,
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
