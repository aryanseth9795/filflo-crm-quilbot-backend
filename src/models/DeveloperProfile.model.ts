import mongoose, { Document, Schema } from 'mongoose';

export interface IDeveloperProfile extends Document {
  userId: mongoose.Types.ObjectId;
  skills: string[];
  domains: string[];
  currentLoad: number;
  totalCompleted: number;
  avgResolutionHrs: number;
  prAcceptRate: number;
  githubUsername?: string;
  updatedAt: Date;
}

const developerProfileSchema = new Schema<IDeveloperProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    skills: [{ type: String, trim: true }],
    domains: [{ type: String, trim: true }],
    currentLoad: { type: Number, default: 0 },
    totalCompleted: { type: Number, default: 0 },
    avgResolutionHrs: { type: Number, default: 0 },
    prAcceptRate: { type: Number, default: 0, min: 0, max: 100 },
    githubUsername: { type: String, trim: true },
  },
  { timestamps: true }
);

export const DeveloperProfile = mongoose.model<IDeveloperProfile>('DeveloperProfile', developerProfileSchema);
