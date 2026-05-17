import mongoose, { Document, Schema } from 'mongoose';

export type TicketRequestType =
  | 'bug'
  | 'error'
  | 'ui_ux_change'
  | 'feature_request'
  | 'special_request'
  | 'miscellaneous';

export type TicketPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type TicketStatus =
  | 'open'
  | 'approved'
  | 'accepted'
  | 'in_progress'
  | 'pr_raised'
  | 'pr_review'
  | 'pr_merged'
  | 'pr_rejected'
  | 'closed'
  | 'rejected';

export type PRStatus = 'none' | 'open' | 'merged' | 'rejected';

export interface IAttachment {
  url: string;
  secureUrl: string;
  publicId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

export type ChangeType = 'code' | 'db_direct';

export interface ITicket extends Document {
  ticketNumber: string;
  projectId: mongoose.Types.ObjectId;
  requestType: TicketRequestType;
  description: string;
  priority: TicketPriority;
  requiredDeliveryDays?: number;
  raisedBy: mongoose.Types.ObjectId;
  referenceUrls: string[];
  attachments: IAttachment[];
  totalAttachmentBytes: number;
  status: TicketStatus;
  approvedBy?: mongoose.Types.ObjectId;
  adminNotes?: string;
  rejectionReason?: string;
  assignedTo?: mongoose.Types.ObjectId;
  changeType?: ChangeType;
  acceptedAt?: Date;
  devStartedAt?: Date;
  devRolloutTime?: Date;
  prStatus: PRStatus;
  prRevisionCount: number;
  clientFeedback?: string;
  supportRemark?: string;
  closedBy?: mongoose.Types.ObjectId;
  closedAt?: Date;
  resolutionHrs?: number;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    secureUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ticketSchema = new Schema<ITicket>(
  {
    ticketNumber: { type: String, required: true, unique: true, trim: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    requestType: {
      type: String,
      enum: ['bug', 'error', 'ui_ux_change', 'feature_request', 'special_request', 'miscellaneous'],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    priority: { type: String, enum: ['P0', 'P1', 'P2', 'P3'], required: true },
    requiredDeliveryDays: { type: Number, min: 1 },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referenceUrls: { type: [String], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    totalAttachmentBytes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        'open', 'approved', 'accepted', 'in_progress',
        'pr_raised', 'pr_review', 'pr_merged', 'pr_rejected',
        'closed', 'rejected',
      ],
      default: 'open',
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    adminNotes: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    changeType: { type: String, enum: ['code', 'db_direct'] },
    acceptedAt: { type: Date },
    devStartedAt: { type: Date },
    devRolloutTime: { type: Date },
    prStatus: { type: String, enum: ['none', 'open', 'merged', 'rejected'], default: 'none' },
    prRevisionCount: { type: Number, default: 0 },
    clientFeedback: { type: String, trim: true },
    supportRemark: { type: String, trim: true },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date },
    resolutionHrs: { type: Number },
  },
  { timestamps: true }
);

// Compound indexes for common query patterns
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ projectId: 1, status: 1 });
ticketSchema.index({ raisedBy: 1, createdAt: -1 });

export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);
