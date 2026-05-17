import { Resend } from 'resend';
import { env } from '../config/env';
import type { EmailProvider, EmailOptions, EmailResult } from './email.provider';

const resendClient = new Resend(env.RESEND_API_KEY);

export const resendProvider: EmailProvider = {
  async send(options: EmailOptions): Promise<EmailResult> {
    const toArray = Array.isArray(options.to) ? options.to : [options.to];
    const { data, error } = await resendClient.emails.send({
      from: options.from ?? env.EMAIL_FROM,
      to: toArray,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
    });

    if (error || !data) {
      throw new Error(`Resend email failed: ${error?.message ?? 'Unknown error'}`);
    }

    return { messageId: data.id, success: true };
  },
};
