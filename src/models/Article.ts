import mongoose, { Document, Schema } from 'mongoose';

export interface IArticle extends Document {
  id: string; // The original hash ID
  language: string;
  category: string;
  title: string;
  content: string;
  sourceName: string;
  sourceUrl: string;
  publishedDate: string;
  publishedTime: string;
  readingTime: number;
  isSaved: boolean;
  savedAt: string | null;
  isActive: boolean;
  isCurrentAffairs: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ArticleSchema = new Schema<IArticle>({
  id: { type: String, required: true, unique: true, index: true },
  language: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  sourceName: { type: String, required: true },
  sourceUrl: { type: String, required: true },
  publishedDate: { type: String, required: true, index: true },
  publishedTime: { type: String, default: '' },
  readingTime: { type: Number, default: 0 },
  isSaved: { type: Boolean, default: false, index: true },
  savedAt: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  isCurrentAffairs: { type: Boolean, default: false, index: true }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Composite indexes for fast queries
ArticleSchema.index({ language: 1, category: 1, publishedDate: -1, publishedTime: -1 });
ArticleSchema.index({ language: 1, isCurrentAffairs: 1, publishedDate: -1 });

export const Article = mongoose.model<IArticle>('Article', ArticleSchema);
