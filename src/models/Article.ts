import mongoose, { Schema, Document } from 'mongoose';

export interface IArticle extends Document {
  title: string;
  guid: string;
  description: string | null;
  content: string;
  language: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  publishedDate: string;
  publishedTime: string;
  readingTime: number;
  thumbnail: string;
  isSaved: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ArticleSchema = new Schema<IArticle>({
  title: { type: String, required: true },
  guid: { type: String, required: true, unique: true, index: true },
  description: { type: String, default: null },
  content: { type: String, required: true },
  language: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  sourceName: { type: String, required: true },
  sourceUrl: { type: String, required: true, unique: true, index: true },
  publishedDate: { type: String, required: true, index: true },
  publishedTime: { type: String, default: '' },
  readingTime: { type: Number, default: 0 },
  thumbnail: { type: String, default: '' },
  isSaved: { type: Boolean, default: false, index: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true // Manages createdAt and updatedAt
});

ArticleSchema.index(
  { title: 'text', content: 'text' },
  { language_override: 'dummy' }
);

// Native MongoDB TTL Index: Auto-delete documents 24 hours (86400 seconds) after createdAt
// The partialFilterExpression ensures that articles saved by users (isSaved: true) are NOT deleted.
ArticleSchema.index(
  { createdAt: 1 }, 
  { expireAfterSeconds: 86400, partialFilterExpression: { isSaved: false } }
);

export const Article = mongoose.model<IArticle>('Article', ArticleSchema);
