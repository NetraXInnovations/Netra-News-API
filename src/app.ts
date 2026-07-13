import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { logger } from './config/logger';

import { Language } from './models/Language';
import { Category } from './models/Category';
import { Article } from './models/Article';
import { SavedArticle } from './models/SavedArticle';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Helper to format article response
const formatArticle = (doc: any) => ({
  id: doc._id.toString(),
  title: doc.title,
  publishedDate: doc.publishedDate,
  publishedTime: doc.publishedTime || '',
  language: doc.language,
  category: doc.category,
  content: doc.content,
  sourceName: doc.sourceName,
  sourceUrl: doc.sourceUrl
});

// GET /api/v1/languages
app.get('/api/v1/languages', async (req: Request, res: Response) => {
  try {
    const langs = await Language.find({ enabled: true }).sort({ name: 1 }).lean();
    res.json(langs.map(l => ({ name: l.name, code: l.code })));
  } catch (error) {
    logger.error('Error fetching languages', error);
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
});

// GET /api/v1/categories
app.get('/api/v1/categories', async (req: Request, res: Response) => {
  try {
    const { language } = req.query;
    if (!language) {
      return res.status(400).json({ error: 'language parameter is required' });
    }
    const cats = await Category.find({ language: language as string, enabled: true }).sort({ name: 1 }).lean();
    res.json(cats.map(c => ({ name: c.name })));
  } catch (error) {
    logger.error('Error fetching categories', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/v1/articles
app.get('/api/v1/articles', async (req: Request, res: Response) => {
  try {
    const { language, category, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    
    const query: any = { isActive: true };
    if (language) query.language = language;
    if (category) query.category = category;

    const articles = await Article.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    res.json(articles.map(formatArticle));
  } catch (error) {
    logger.error('Error fetching articles', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// GET /api/v1/articles/:articleId
app.get('/api/v1/articles/:articleId', async (req: Request, res: Response) => {
  try {
    const article = await Article.findById(req.params.articleId).lean();
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(formatArticle(article));
  } catch (error) {
    logger.error('Error fetching article', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// GET /api/v1/search
app.get('/api/v1/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

    const articles = await Article.find(
      { $text: { $search: q as string }, isActive: true },
      { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" } })
    .limit(20)
    .lean();

    res.json(articles.map(formatArticle));
  } catch (error) {
    logger.error('Error searching articles', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /api/v1/articles/:id/save
app.post('/api/v1/articles/:id/save', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Hardcoded dummy user ID for now since auth isn't implemented
    const userId = req.headers['x-user-id'] || 'anonymous-user'; 
    
    const article = await Article.findById(id);
    if (!article) return res.status(404).json({ error: 'Article not found' });

    await SavedArticle.updateOne(
      { userId: userId as string, articleId: id },
      { $set: { userId: userId as string, articleId: id, savedAt: new Date() } },
      { upsert: true }
    );

    // Update article to prevent deletion
    article.isSaved = true;
    await article.save();

    res.json({ success: true, message: 'Article saved' });
  } catch (error) {
    logger.error('Error saving article', error);
    res.status(500).json({ error: 'Failed to save article' });
  }
});

// DELETE /api/v1/articles/:id/save
app.delete('/api/v1/articles/:id/save', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous-user';

    await SavedArticle.deleteOne({ userId: userId as string, articleId: id });

    // Check if anyone else has this article saved
    const otherSaves = await SavedArticle.countDocuments({ articleId: id });
    if (otherSaves === 0) {
      await Article.findByIdAndUpdate(id, { isSaved: false });
    }

    res.json({ success: true, message: 'Article unsaved' });
  } catch (error) {
    logger.error('Error unsaving article', error);
    res.status(500).json({ error: 'Failed to unsave article' });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Root endpoint so the browser doesn't show an error
app.get('/', (req: Request, res: Response) => {
  res.send('<h1>Netra News Hub API is Live! 🚀</h1><p>Use /api/v1/articles to get news.</p>');
});

export default app;
