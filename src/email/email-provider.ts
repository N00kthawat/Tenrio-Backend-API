export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailProvider {
  sendEmail(input: SendEmailInput): Promise<void>;
}
