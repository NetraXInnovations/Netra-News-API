import mongoose, { Schema, Document } from 'mongoose';

// ── Article (one topic within a section) ────────────────────────────────────
export interface IArticle {
  title: string;
  imageUrl: string;
  summary: string;
  keyFacts: string[];
  content: string;
}

// ── Section (e.g. NATIONAL AFFAIRS, SPORTS, etc.) ───────────────────────────
export interface ISection {
  title: string;
  articles: IArticle[];
}

// ── Daily issue (one document = one day) ─────────────────────────────────────
export interface ICurrentAffairIssue extends Document {
  issueDate: string;            // "2026-07-14"
  publishedTime: string;        // "01:30"
  sourceUrl: string;
  totalTopics: number;
  estimatedReadingTime: number; // minutes
  sections: ISection[];
  isSaved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Sub-schemas (no _id needed on sub-docs) ──────────────────────────────────
const ArticleSchema = new Schema<IArticle>(
  {
    title:    { type: String, required: true },
    imageUrl: { type: String, default: '' },
    summary:  { type: String, default: '' },
    keyFacts: [{ type: String }],
    content:  { type: String, required: true },
  },
  { _id: false }
);

const SectionSchema = new Schema<ISection>(
  {
    title:    { type: String, required: true },
    articles: [ArticleSchema],
  },
  { _id: false }
);

// ── Main schema ──────────────────────────────────────────────────────────────
const CurrentAffairIssueSchema = new Schema<ICurrentAffairIssue>(
  {
    issueDate:            { type: String, required: true, unique: true }, // one doc per day
    publishedTime:        { type: String, default: '00:00' },
    sourceUrl:            { type: String, required: true },
    totalTopics:          { type: Number, default: 0 },
    estimatedReadingTime: { type: Number, default: 0 },
    sections:             [SectionSchema],
    isSaved:              { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes
CurrentAffairIssueSchema.index({ issueDate: -1 });

// Native MongoDB TTL Index: Auto-delete documents 24 hours (86400 seconds) after createdAt
// The partialFilterExpression ensures that items saved by users (isSaved: true) are NOT deleted.
CurrentAffairIssueSchema.index(
  { createdAt: 1 }, 
  { expireAfterSeconds: 86400, partialFilterExpression: { isSaved: false } }
);

export const CurrentAffair = mongoose.model<ICurrentAffairIssue>(
  'CurrentAffair',
  CurrentAffairIssueSchema,
  'current_affairs'
);
