import mongoose, { Document, Schema } from 'mongoose';

export interface IRssSource extends Document {
  sourceName: string;
  rssUrl: string;
  language: string;
  category: string;
  enabled: boolean;
  priority: number;
  lastCheckedAt: Date | null;
}

const RssSourceSchema = new Schema<IRssSource>({
  sourceName: { type: String, required: true },
  rssUrl: { type: String, required: true, unique: true },
  language: { type: String, required: true },
  category: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  priority: { type: Number, default: 0 },
  lastCheckedAt: { type: Date, default: null }
}, {
  timestamps: true
});

export const RssSource = mongoose.model<IRssSource>('RssSource', RssSourceSchema);
