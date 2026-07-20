import mongoose, { Schema, Document } from 'mongoose';

export interface IRssSource extends Document {
  language: string;
  category: string;       // Native script display name, e.g. "ఆంధ్రప్రదేశ్"
  categoryId: string;     // Stable English slug for filtering, e.g. "andhra-pradesh"
  sourceName: string;
  rssUrl: string;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  lastCheckedAt: Date | null;
  // Feed health tracking
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastItemCount: number;
  consecutiveFailures: number;
  status: 'OK' | 'FAILING' | 'UNKNOWN';
}

const RssSourceSchema = new Schema<IRssSource>({
  language:            { type: String, required: true, index: true },
  category:            { type: String, required: true, index: true },
  categoryId:          { type: String, required: true, index: true, default: '' },
  sourceName:          { type: String, required: true },
  rssUrl:              { type: String, required: true, unique: true, index: true },
  priority:            { type: Number, default: 10 },
  enabled:             { type: Boolean, default: true },
  lastCheckedAt:       { type: Date, default: null },
  // Health fields
  lastSuccessAt:       { type: Date, default: null },
  lastFailureAt:       { type: Date, default: null },
  lastItemCount:       { type: Number, default: 0 },
  consecutiveFailures: { type: Number, default: 0 },
  status:              { type: String, enum: ['OK', 'FAILING', 'UNKNOWN'], default: 'UNKNOWN' },
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const RssSource = mongoose.model<IRssSource>('RssSource', RssSourceSchema);
