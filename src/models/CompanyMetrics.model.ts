import mongoose, { Document, Schema } from 'mongoose';

export interface ICompanyMetrics extends Document {
  companyName: string;
  totalQueries: number;
  resolvedQueries: number;
  avgResolutionHrs: number;
  openTickets: number;
  lastQueryDate?: Date;
  updatedAt: Date;
}

const companyMetricsSchema = new Schema<ICompanyMetrics>(
  {
    companyName: { type: String, required: true, unique: true, trim: true },
    totalQueries: { type: Number, default: 0 },
    resolvedQueries: { type: Number, default: 0 },
    avgResolutionHrs: { type: Number, default: 0 },
    openTickets: { type: Number, default: 0 },
    lastQueryDate: { type: Date },
  },
  { timestamps: true }
);

export const CompanyMetrics = mongoose.model<ICompanyMetrics>('CompanyMetrics', companyMetricsSchema);
