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
  publishedDate: doc.publishedTime ? `${doc.publishedDate}_${doc.publishedTime}` : doc.publishedDate,
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
    logger.error(error, 'Error fetching languages');
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
    logger.error(error, 'Error fetching categories');
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
    logger.error(error, 'Error fetching articles');
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
    logger.error(error, 'Error fetching article');
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
    logger.error(error, 'Error searching articles');
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /api/v1/articles/:id/save
app.post('/api/v1/articles/:id/save', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous-user'; 
    
    const article = await Article.findById(id);
    if (!article) return res.status(404).json({ error: 'Article not found' });

    await SavedArticle.updateOne(
      { userId: userId as string, articleId: id },
      { $set: { userId: userId as string, articleId: id, savedAt: new Date() } },
      { upsert: true }
    );

    article.isSaved = true;
    await article.save();

    res.json({ success: true, message: 'Article saved' });
  } catch (error) {
    logger.error(error, 'Error saving article');
    res.status(500).json({ error: 'Failed to save article' });
  }
});

// DELETE /api/v1/articles/:id/save
app.delete('/api/v1/articles/:id/save', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous-user';

    await SavedArticle.deleteOne({ userId: userId as string, articleId: id });

    const otherSaves = await SavedArticle.countDocuments({ articleId: id });
    if (otherSaves === 0) {
      await Article.findByIdAndUpdate(id, { isSaved: false });
    }

    res.json({ success: true, message: 'Article unsaved' });
  } catch (error) {
    logger.error(error, 'Error unsaving article');
    res.status(500).json({ error: 'Failed to unsave article' });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Root endpoint: Beautiful HTML Welcome Board
app.get('/', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Netra News Hub API</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700&display=swap');
        body {
          margin: 0;
          padding: 0;
          font-family: 'Outfit', sans-serif;
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .container {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 50px 40px;
          text-align: center;
          max-width: 600px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          animation: fadeIn 1s ease-out;
        }
        h1 {
          font-size: 2.5rem;
          margin-bottom: 10px;
          background: linear-gradient(to right, #38bdf8, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        p {
          font-size: 1.1rem;
          color: #94a3b8;
          margin-bottom: 30px;
        }
        .endpoint-box {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
          padding: 20px;
          text-align: left;
        }
        .endpoint {
          margin: 15px 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .badge {
          background: #3b82f6;
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: bold;
          align-self: flex-start;
        }
        .url {
          color: #38bdf8;
          font-family: monospace;
          font-size: 1.1rem;
          word-break: break-all;
        }
        .desc {
          font-size: 0.85rem;
          color: #cbd5e1;
          margin-top: 2px;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Netra News Hub API</h1>
        <p>Your ultra-fast, dynamic news backend is running perfectly.</p>
        
        <div class="endpoint-box">
          
          <div class="endpoint">
            <span class="badge">Languages</span>
            <span class="url">/api/v1/languages</span>
            <span class="desc">Get all supported languages</span>
          </div>

          <div class="endpoint">
            <span class="badge">English Categories</span>
            <span class="url">/api/v1/categories?language=English</span>
            <span class="desc">Get all categories for English news</span>
          </div>

          <div class="endpoint">
            <span class="badge">Hindi Categories</span>
            <span class="url">/api/v1/categories?language=Hindi</span>
            <span class="desc">Get all categories for Hindi news</span>
          </div>

          <div class="endpoint">
            <span class="badge">Telugu Categories</span>
            <span class="url">/api/v1/categories?language=Telugu</span>
            <span class="desc">Get all categories for Telugu news</span>
          </div>

          <div class="endpoint">
            <span class="badge">English Articles</span>
            <span class="url">/api/v1/articles?language=English</span>
            <span class="desc">Get all English news articles</span>
          </div>

          <div class="endpoint">
            <span class="badge">Hindi Articles</span>
            <span class="url">/api/v1/articles?language=Hindi</span>
            <span class="desc">Get all Hindi news articles</span>
          </div>

          <div class="endpoint">
            <span class="badge">Telugu Articles</span>
            <span class="url">/api/v1/articles?language=Telugu</span>
            <span class="desc">Get all Telugu news articles</span>
          </div>

        </div>
      </div>
    </body>
    </html>
  `);
});

export default app;
