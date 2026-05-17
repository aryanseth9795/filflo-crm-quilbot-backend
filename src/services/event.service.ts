import { TicketEvent, TicketEventType } from '../models/TicketEvent.model';

interface LogEventOptions {
  ticketId: string;
  event: TicketEventType;
  performedBy?: string;
  performedByName?: string;
  metadata?: Record<string, unknown>;
}

export const eventService = {
  async logEvent({ ticketId, event, performedBy, performedByName, metadata }: LogEventOptions) {
    return TicketEvent.create({
      ticketId,
      event,
      ...(performedBy && { performedBy }),
      ...(performedByName && { performedByName }),
      ...(metadata && { metadata }),
    });
  },

  async getTimeline(ticketId: string) {
    return TicketEvent.find({ ticketId })
      .sort({ timestamp: 1 })
      .lean();
  },
};
