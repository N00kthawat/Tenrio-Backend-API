import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { EmailProvider, SendEmailInput } from './email-provider';

type ResendEmailResponse = {
  id?: string;
};

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  async sendEmail(input: SendEmailInput): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
      throw new ServiceUnavailableException('Email provider is not configured.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Tenrio-Backend-API',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('Email provider request failed.');
    }

    const responseBody = (await response.json()) as ResendEmailResponse;

    if (!responseBody.id) {
      throw new ServiceUnavailableException('Email provider request failed.');
    }
  }
}
