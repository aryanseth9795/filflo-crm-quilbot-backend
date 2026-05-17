import fs from 'fs';
import path from 'path';
import { getEmailProvider } from '../providers';
import { env } from '../config/env';
import { logger } from '../config/logger';

// process.cwd() is the server/ directory in both dev and prod (Render starts the process there)
const TEMPLATE_DIR = path.join(process.cwd(), 'src/templates');

function loadTemplate(name: string): string {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf-8');
}

function render(template: string, vars: Record<string, string | number | boolean | undefined>): string {
  let html = template;
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined || value === null || value === '') {
      // Remove conditional blocks for missing values
      const condRegex = new RegExp(`\\{\\{#if ${key}\\}\\}[\\s\\S]*?\\{\\{\\/if\\}\\}`, 'g');
      html = html.replace(condRegex, '');
    } else {
      // Replace conditional blocks — keep content
      const condRegex = new RegExp(`\\{\\{#if ${key}\\}\\}([\\s\\S]*?)\\{\\{\\/if\\}\\}`, 'g');
      html = html.replace(condRegex, '$1');
      // Replace variable
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }
  }
  return html;
}

function priorityClass(priority: string): string {
  return `p${priority.toLowerCase().replace('p', '')}`;
}

function ticketUrl(ticketId: string): string {
  return `${env.CLIENT_URL}/tickets/${ticketId}`;
}

async function safeSend(
  to: string | string[],
  subject: string,
  html: string
): Promise<void> {
  try {
    const emailProvider = getEmailProvider();
    await emailProvider.send({ to, subject, html });
  } catch (err: any) {
    logger.error(`[NotificationService] Failed to send email to ${to}: ${err.message}`);
  }
}

export const notificationService = {
  async ticketCreated(params: {
    adminEmails: string[];
    ticketId: string;
    ticketNumber: string;
    projectName: string;
    requestType: string;
    description: string;
    priority: string;
    raisedByName: string;
    raisedByEmail: string;
    requiredDeliveryDays?: number;
    attachmentCount: number;
  }) {
    const template = loadTemplate('ticket-created.html');
    const html = render(template, {
      ticketNumber: params.ticketNumber,
      projectName: params.projectName,
      requestType: params.requestType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: params.description,
      priority: params.priority,
      priorityClass: priorityClass(params.priority),
      raisedByName: params.raisedByName,
      raisedByEmail: params.raisedByEmail,
      requiredDeliveryDays: params.requiredDeliveryDays,
      attachmentCount: params.attachmentCount || undefined,
      ticketUrl: ticketUrl(params.ticketId),
    });
    await safeSend(params.adminEmails, `[Filflo] New Ticket ${params.ticketNumber} — Action Required`, html);
  },

  async ticketAssigned(params: {
    developerEmail: string;
    developerName: string;
    ticketId: string;
    ticketNumber: string;
    projectName: string;
    requestType: string;
    description: string;
    priority: string;
    adminNotes?: string;
    requiredDeliveryDays?: number;
    attachmentCount: number;
  }) {
    const template = loadTemplate('ticket-assigned.html');
    const html = render(template, {
      developerName: params.developerName,
      ticketNumber: params.ticketNumber,
      projectName: params.projectName,
      requestType: params.requestType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: params.description,
      priority: params.priority,
      priorityClass: priorityClass(params.priority),
      adminNotes: params.adminNotes,
      requiredDeliveryDays: params.requiredDeliveryDays,
      attachmentCount: params.attachmentCount || undefined,
      ticketUrl: ticketUrl(params.ticketId),
    });
    await safeSend(params.developerEmail, `[Filflo] Ticket ${params.ticketNumber} Assigned to You`, html);
  },

  async ticketRejected(params: {
    supportEmail: string;
    ticketId: string;
    ticketNumber: string;
    projectName: string;
    rejectionReason: string;
  }) {
    const template = loadTemplate('rejection.html');
    const html = render(template, {
      ticketNumber: params.ticketNumber,
      projectName: params.projectName,
      statusLabel: 'REJECTED',
      reasonLabel: 'Rejection Reason',
      reason: params.rejectionReason,
    });
    await safeSend(params.supportEmail, `[Filflo] Ticket ${params.ticketNumber} Was Rejected`, html);
  },

  async prRaised(params: {
    adminEmails: string[];
    ticketId: string;
    ticketNumber: string;
    projectName: string;
    prNumber: number;
    prUrl: string;
    triggeredBy: string;
    attachmentCount: number;
  }) {
    const template = loadTemplate('pr-status.html');
    const html = render(template, {
      ticketNumber: params.ticketNumber,
      projectName: params.projectName,
      statusLabel: 'PR RAISED — REVIEW NEEDED',
      badgeClass: 'review',
      prNumber: params.prNumber,
      prUrl: params.prUrl,
      triggeredBy: params.triggeredBy,
      attachmentCount: params.attachmentCount || undefined,
      ticketUrl: ticketUrl(params.ticketId),
    });
    await safeSend(params.adminEmails, `[Filflo] PR Raised for ${params.ticketNumber} — Review Needed`, html);
  },

  async prMerged(params: {
    supportEmail: string;
    developerEmail: string;
    ticketId: string;
    ticketNumber: string;
    projectName: string;
    prNumber: number;
    prUrl: string;
    triggeredBy: string;
    attachmentCount: number;
  }) {
    const template = loadTemplate('pr-status.html');
    const html = render(template, {
      ticketNumber: params.ticketNumber,
      projectName: params.projectName,
      statusLabel: 'PR MERGED ✓',
      badgeClass: 'pr',
      prNumber: params.prNumber,
      prUrl: params.prUrl,
      triggeredBy: params.triggeredBy,
      attachmentCount: params.attachmentCount || undefined,
      ticketUrl: ticketUrl(params.ticketId),
    });
    await safeSend(
      [params.supportEmail, params.developerEmail],
      `[Filflo] PR Merged for ${params.ticketNumber}`,
      html
    );
  },

  async prRejected(params: {
    developerEmail: string;
    ticketId: string;
    ticketNumber: string;
    projectName: string;
    rejectionReason: string;
    revisionCount: number;
  }) {
    const template = loadTemplate('rejection.html');
    const html = render(template, {
      ticketNumber: params.ticketNumber,
      projectName: params.projectName,
      statusLabel: 'PR REJECTED',
      reasonLabel: 'Rejection Notes',
      reason: params.rejectionReason,
      revisionCount: params.revisionCount,
    });
    await safeSend(
      params.developerEmail,
      `[Filflo] PR Rejected for ${params.ticketNumber} — Revision #${params.revisionCount} Needed`,
      html
    );
  },

  async ticketClosed(params: {
    developerEmail: string;
    adminEmails: string[];
    ticketId: string;
    ticketNumber: string;
    projectName: string;
    resolutionHrs: number;
    closedByName: string;
    supportRemark?: string;
    clientFeedback?: string;
  }) {
    const template = loadTemplate('ticket-closed.html');
    const html = render(template, {
      ticketNumber: params.ticketNumber,
      projectName: params.projectName,
      resolutionHrs: params.resolutionHrs,
      closedByName: params.closedByName,
      supportRemark: params.supportRemark,
      clientFeedback: params.clientFeedback,
    });
    await safeSend(
      [params.developerEmail, ...params.adminEmails],
      `[Filflo] Ticket ${params.ticketNumber} Closed`,
      html
    );
  },
};
