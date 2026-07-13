import mongoose, { Schema, Document } from 'mongoose';

export interface ISavedArticle extends Document {
  userId: string;
  articleId: string;
  savedAt: Date;
}

const SavedArticleSchema = new Schema<ISavedArticle>({
  userId: { type: String, required: true, index: true },
  articleId: { type: String, required: true, index: true },
  savedAt: { type: Date, default: Date.now }
});

// Ensure a user can only save an article once
SavedArticleSchema.index({ userId: 1, articleId: 1 }, { unique: true });

export const SavedArticle = mongoose.model<ISavedArticle>('SavedArticle', SavedArticleSchema);
