import mongoose, { Schema, Document } from 'mongoose';

export interface ILanguage extends Document {
  name: string;
  code: string;
  enabled: boolean;
  createdAt: Date;
}

const LanguageSchema = new Schema<ILanguage>({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true, index: true },
  enabled: { type: Boolean, default: true },
}, {
  timestamps: true
});

export const Language = mongoose.model<ILanguage>('Language', LanguageSchema);
