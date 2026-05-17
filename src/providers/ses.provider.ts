import type { EmailProvider, EmailOptions, EmailResult } from './email.provider';

/**
 * AWS SES provider — stub ready for implementation.
 * Install: @aws-sdk/client-ses
 * Set env: EMAIL_PROVIDER=ses, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 */
export const sesProvider: EmailProvider = {
  async send(_options: EmailOptions): Promise<EmailResult> {
    throw new Error(
      'SES provider not yet implemented. Set EMAIL_PROVIDER=resend or implement this provider.'
    );
  },
};
