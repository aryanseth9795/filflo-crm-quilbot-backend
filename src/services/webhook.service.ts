import { PREvent } from '../models/PREvent.model';
import { Ticket } from '../models/Ticket.model';
import { User } from '../models/User.model';
import { projectService } from './project.service';
import { ticketService } from './ticket.service';
import { notificationService } from './notification.service';
import { eventService } from './event.service';
import { verifyGitHubSignature, extractTicketNumbers } from '../utils/github';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';

interface GitHubPRPayload {
  action: string;
  number: number;
  pull_request: {
    title: string;
    html_url: string;
    merged: boolean;
    user: { login: string };
  };
  repository: {
    full_name: string;
  };
}

export const webhookService = {
  async processGitHubEvent(
    projectId: string,
    rawBody: Buffer,
    signature: string | undefined,
    payload: GitHubPRPayload
  ) {
    const project = await projectService.getByIdWithSecret(projectId);
    const isValid = verifyGitHubSignature(rawBody, signature, project.webhookSecret);
    if (!isValid) throw new AppError('Invalid webhook signature', 401);

    if (
      payload.action !== 'opened' &&
      payload.action !== 'closed' &&
      payload.action !== 'reopened'
    ) {
      return { processed: false, reason: `Ignoring action: ${payload.action}` };
    }

    const ticketNumbers = extractTicketNumbers(payload.pull_request.title);
    if (ticketNumbers.length === 0) {
      logger.info(`PR #${payload.number}: no ticket numbers in title`);
      return { processed: false, reason: 'No ticket numbers found in PR title' };
    }

    const action =
      payload.pull_request.merged ? 'merged'
      : payload.action === 'closed' ? 'rejected'
      : (payload.action as 'opened' | 'reopened');

    const results: { ticketNumber: string; status: string }[] = [];
    const admins = await User.find({ role: 'admin', isActive: true }).select('email name').lean();

    for (const ticketNumber of ticketNumbers) {
      try {
        const ticket = await Ticket.findOne({ ticketNumber })
          .populate('raisedBy', 'email name')
          .populate('assignedTo', 'email name');

        if (!ticket) { results.push({ ticketNumber, status: 'not_found' }); continue; }
        if (ticket.projectId.toString() !== projectId) { results.push({ ticketNumber, status: 'project_mismatch' }); continue; }

        const currentRevision = ticket.prRevisionCount ?? 0;

        // Atomic idempotency — relies on PREvent's unique index on
        // { prNumber, projectId, action }. If another concurrent delivery
        // already inserted this PREvent, E11000 fires and we skip before
        // touching Ticket, TicketEvent, or notificationService.
        try {
          await PREvent.create({
            ticketId: ticket._id,
            projectId,
            prNumber: payload.number,
            prUrl: payload.pull_request.html_url,
            repoFullName: payload.repository.full_name,
            action,
            triggeredBy: payload.pull_request.user.login,
            revisionNumber: currentRevision + (action === 'opened' ? 1 : 0),
          });
        } catch (err: any) {
          if (err?.code === 11000) {
            results.push({ ticketNumber, status: 'duplicate_skipped' });
            continue;
          }
          throw err;
        }

        const dev = ticket.assignedTo as any;
        const raiser = ticket.raisedBy as any;

        if (action === 'opened' || action === 'reopened') {
          ticket.status = 'pr_raised';
          ticket.prStatus = 'open';
          await ticket.save();

          await eventService.logEvent({
            ticketId: ticket._id.toString(),
            event: action === 'reopened' ? 'pr_reopened' : 'pr_raised',
            performedByName: payload.pull_request.user.login,
            metadata: { prNumber: payload.number, prUrl: payload.pull_request.html_url },
          });

          // Notify admins only
          await notificationService.prRaised({
            adminEmails: admins.map(a => a.email),
            ticketId: ticket._id.toString(),
            ticketNumber,
            projectName: project.name,
            prNumber: payload.number,
            prUrl: payload.pull_request.html_url,
            triggeredBy: payload.pull_request.user.login,
            attachmentCount: ticket.attachments.length,
          });
          results.push({ ticketNumber, status: `pr_raised` });

        } else if (action === 'merged') {
          ticket.prStatus = 'merged';
          ticket.status = 'pr_merged';
          await ticket.save();

          await eventService.logEvent({
            ticketId: ticket._id.toString(),
            event: 'pr_merged',
            performedByName: payload.pull_request.user.login,
            metadata: { prNumber: payload.number, prUrl: payload.pull_request.html_url },
          });

          // Notify support + dev
          if (raiser?.email && dev?.email) {
            await notificationService.prMerged({
              supportEmail: raiser.email,
              developerEmail: dev.email,
              ticketId: ticket._id.toString(),
              ticketNumber,
              projectName: project.name,
              prNumber: payload.number,
              prUrl: payload.pull_request.html_url,
              triggeredBy: payload.pull_request.user.login,
              attachmentCount: ticket.attachments.length,
            });
          }
          results.push({ ticketNumber, status: 'pr_merged' });

        } else if (action === 'rejected') {
          ticket.prStatus = 'rejected';
          ticket.status = 'pr_rejected';
          ticket.prRevisionCount = currentRevision + 1;
          await ticket.save();

          await eventService.logEvent({
            ticketId: ticket._id.toString(),
            event: 'pr_rejected',
            performedByName: payload.pull_request.user.login,
            metadata: { prNumber: payload.number, prUrl: payload.pull_request.html_url, revisionCount: ticket.prRevisionCount },
          });

          // Notify dev only
          if (dev?.email) {
            await notificationService.prRejected({
              developerEmail: dev.email,
              ticketId: ticket._id.toString(),
              ticketNumber,
              projectName: project.name,
              rejectionReason: 'PR was closed without merging',
              revisionCount: ticket.prRevisionCount,
            });
          }
          results.push({ ticketNumber, status: 'pr_rejected' });
        }

      } catch (err: any) {
        logger.error(`Error processing ticket ${ticketNumber}: ${err.message}`);
        results.push({ ticketNumber, status: `error: ${err.message}` });
      }
    }

    return { processed: true, prNumber: payload.number, results };
  },
};
