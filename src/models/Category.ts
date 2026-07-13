import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  language: string; // The language code, e.g. "en" or "english"
  name: string;
  enabled: boolean;
  createdAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  language: { type: String, required: true, index: true },
  name: { type: String, required: true, index: true },
  enabled: { type: Boolean, default: true },
}, {
  timestamps: true // This will automatically manage createdAt and updatedAt
});

// Ensure a category is unique per language
CategorySchema.index({ language: 1, name: 1 }, { unique: true });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
