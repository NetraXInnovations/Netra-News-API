import mongoose, { Schema, Document } from 'mongoose';

export interface IArticle extends Document {
  title: string;
  guid: string;
  description: string | null;
  content: string;
  language: string;
  category: string;    // Native script display name, e.g. "ఆంధ్రప్రదేశ్"
  categoryId: string;  // Stable English slug for filtering, e.g. "andhra-pradesh"
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
  title:         { type: String, required: true },
  guid:          { type: String, required: true, unique: true, index: true },
  description:   { type: String, default: null },
  content:       { type: String, required: true },
  language:      { type: String, required: true, index: true },
  category:      { type: String, required: true, index: true },
  categoryId:    { type: String, required: true, index: true, default: '' },
  sourceName:    { type: String, required: true },
  sourceUrl:     { type: String, required: true, index: true },
  publishedDate: { type: String, required: true, index: true },
  publishedTime: { type: String, default: '' },
  readingTime:   { type: Number, default: 0 },
  thumbnail:     { type: String, default: '' },
  isSaved:       { type: Boolean, default: false, index: true },
  isActive:      { type: Boolean, default: true }
}, {
  timestamps: true
});

// Full-text search index
ArticleSchema.index(
  { title: 'text', content: 'text' },
  { language_override: 'dummy' }
);

// NOTE: We intentionally removed the MongoDB TTL index.
// Cleanup is now handled by CleanupService, which only deletes old articles
// AFTER a successful RSS sync — preventing the DB from being emptied on sync failure.

export const Article = mongoose.model<IArticle>('Article', ArticleSchema);
