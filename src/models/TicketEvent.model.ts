import mongoose, { Document, Schema } from 'mongoose';

export type TicketEventType =
  | 'created'
  | 'approved'
  | 'rejected'
  | 'accepted'
  | 'work_started'
  | 'rollout_set'
  | 'pr_raised'
  | 'pr_merged'
  | 'pr_rejected'
  | 'pr_reopened'
  | 'db_change_completed'
  | 'feedback_added'
  | 'closed';

export interface ITicketEvent extends Document {
  ticketId: mongoose.Types.ObjectId;
  event: TicketEventType;
  performedBy?: mongoose.Types.ObjectId;
  performedByName?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

const ticketEventSchema = new Schema<ITicketEvent>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    event: {
      type: String,
      enum: [
        'created', 'approved', 'rejected', 'accepted', 'work_started',
        'rollout_set', 'pr_raised', 'pr_merged', 'pr_rejected', 'pr_reopened',
        'db_change_completed', 'feedback_added', 'closed',
      ],
      required: true,
    },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    performedByName: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

ticketEventSchema.index({ ticketId: 1, timestamp: 1 });

export const TicketEvent = mongoose.model<ITicketEvent>('TicketEvent', ticketEventSchema);
