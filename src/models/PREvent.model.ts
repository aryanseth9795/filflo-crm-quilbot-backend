import mongoose, { Document, Schema } from 'mongoose';

export type PRAction = 'opened' | 'merged' | 'rejected' | 'reopened';

export interface IPREvent extends Document {
  ticketId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  prNumber: number;
  prUrl: string;
  repoFullName: string;
  action: PRAction;
  triggeredBy: string;
  revisionNumber: number;
  timestamp: Date;
}

const prEventSchema = new Schema<IPREvent>({
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  prNumber: { type: Number, required: true },
  prUrl: { type: String, required: true },
  repoFullName: { type: String, required: true },
  action: { type: String, enum: ['opened', 'merged', 'rejected', 'reopened'], required: true },
  triggeredBy: { type: String, required: true },
  revisionNumber: { type: Number, default: 1 },
  timestamp: { type: Date, default: Date.now },
});

// Unique index for idempotency — prevents duplicate processing of same GitHub event
prEventSchema.index({ prNumber: 1, projectId: 1, action: 1 }, { unique: true });
prEventSchema.index({ ticketId: 1 });

export const PREvent = mongoose.model<IPREvent>('PREvent', prEventSchema);
