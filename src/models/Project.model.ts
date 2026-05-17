import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description?: string;
  githubRepoUrl?: string;
  webhookSecret: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  mainDeveloper?: mongoose.Types.ObjectId;
  ticketCounter: number;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    githubRepoUrl: { type: String, trim: true },
    webhookSecret: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mainDeveloper: { type: Schema.Types.ObjectId, ref: 'User' },
    ticketCounter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Project = mongoose.model<IProject>('Project', projectSchema);
