import { ServiceUnavailableException } from '@nestjs/common';

import { ResendEmailProvider } from '../src/email/resend-email.provider';

describe('ResendEmailProvider', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-resend-api-key';
    process.env.EMAIL_FROM = 'Tenrio <no-reply@example.com>';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it('sends email through Resend', async () => {
    const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
      () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'email_123' }),
        } as Response),
    );
    globalThis.fetch = fetchMock;

    const provider = new ResendEmailProvider();

    await provider.sendEmail({
      to: 'customer@example.com',
      subject: 'Verify your Tenrio email address',
      html: '<p>Verify</p>',
      text: 'Verify',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-resend-api-key',
          'Content-Type': 'application/json',
          'User-Agent': 'Tenrio-Backend-API',
        }) as HeadersInit,
        body: JSON.stringify({
          from: 'Tenrio <no-reply@example.com>',
          to: ['customer@example.com'],
          subject: 'Verify your Tenrio email address',
          html: '<p>Verify</p>',
          text: 'Verify',
        }),
      }),
    );
  });

  it('handles provider failures safely', async () => {
    globalThis.fetch = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
      () =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'invalid api key' }),
        } as Response),
    );

    const provider = new ResendEmailProvider();

    await expect(
      provider.sendEmail({
        to: 'customer@example.com',
        subject: 'Verify',
        html: '<p>Verify</p>',
        text: 'Verify',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
