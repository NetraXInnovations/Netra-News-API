import mongoose, { Document, Schema } from 'mongoose';

export interface ICurrentAffair extends Document {
  title: string;
  content: string;
  publishedDate: string;
  publishedTime: string;
  sourceUrl: string;
  sourceName: string;
  readingTime: number;
  isSaved: boolean;
  isActive: boolean;
  createdAt: Date;
}

const CurrentAffairSchema: Schema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  publishedDate: { type: String, required: true },
  publishedTime: { type: String, required: true },
  sourceUrl: { type: String, required: true },
  sourceName: { type: String, required: true, default: 'AffairsCloud' },
  readingTime: { type: Number, required: true },
  isSaved: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// Compound index for uniqueness
CurrentAffairSchema.index({ title: 1, sourceUrl: 1 }, { unique: true });

// Text index for search
CurrentAffairSchema.index({ title: 'text', content: 'text' });
CurrentAffairSchema.index({ createdAt: -1 });

export const CurrentAffair = mongoose.model<ICurrentAffair>('CurrentAffair', CurrentAffairSchema, 'current_affairs');
