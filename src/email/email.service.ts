import { Inject, Injectable } from '@nestjs/common';

import {
  EMAIL_PROVIDER,
  EmailProvider,
  SendEmailInput,
} from './email-provider';

@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
  ) {}

  sendEmail(input: SendEmailInput): Promise<void> {
    return this.emailProvider.sendEmail(input);
  }
}
