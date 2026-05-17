export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  messageId: string;
  success: boolean;
}

export interface EmailProvider {
  send(options: EmailOptions): Promise<EmailResult>;
}
