import mongoose, { Schema, Document } from 'mongoose';

export interface IRssSource extends Document {
  language: string;
  category: string;
  sourceName: string;
  rssUrl: string;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  lastCheckedAt: Date | null;
}

const RssSourceSchema = new Schema<IRssSource>({
  language: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  sourceName: { type: String, required: true },
  rssUrl: { type: String, required: true, unique: true, index: true },
  priority: { type: Number, default: 10 },
  enabled: { type: Boolean, default: true },
  lastCheckedAt: { type: Date, default: null }
}, {
  timestamps: { createdAt: true, updatedAt: false } // Only createdAt as requested
});

export const RssSource = mongoose.model<IRssSource>('RssSource', RssSourceSchema);
