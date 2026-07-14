import mongoose, { Schema, Document } from 'mongoose';

export interface ICurrentAffair extends Document {
  title: string;
  summary: string;
  keyFacts: string[];
  importantPoints: string[];
  content: string;
  publishedDate: string;
  publishedTime: string;
  sourceName: string;
  sourceUrl: string;
  readingTime: number;
  isActive: boolean;
  isSaved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CurrentAffairSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    keyFacts: [{ type: String }],
    importantPoints: [{ type: String }],
    content: { type: String, required: true },
    publishedDate: { type: String, required: true },
    publishedTime: { type: String, required: true },
    sourceName: { type: String, default: 'AffairsCloud' },
    sourceUrl: { type: String, required: true },
    readingTime: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isSaved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes
CurrentAffairSchema.index({ publishedDate: -1, publishedTime: -1, createdAt: -1 });
CurrentAffairSchema.index({ sourceUrl: 1 });
CurrentAffairSchema.index({ title: 'text', content: 'text' });

export const CurrentAffair = mongoose.model<ICurrentAffair>('CurrentAffair', CurrentAffairSchema, 'current_affairs');
