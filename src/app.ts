import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { logger } from './config/logger';

import { Language } from './models/Language';
import { Category } from './models/Category';
import { Article } from './models/Article';
import { SavedArticle } from './models/SavedArticle';
import { CurrentAffair } from './models/CurrentAffair';
import { AffairsCloudParser } from './services/affairsCloudParser';

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
      .sort({ publishedDate: -1, publishedTime: -1 })
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

// --- CURRENT AFFAIRS API ---

// Helper to format current affair response
const formatCurrentAffair = (doc: any) => ({
  id: doc._id.toString(),
  title: doc.title,
  publishedDate: doc.publishedDate,
  publishedTime: doc.publishedTime,
  content: doc.content
});

// GET /api/v1/current-affairs
app.get('/api/v1/current-affairs', async (req: Request, res: Response) => {
  try {
    const currentAffairs = await CurrentAffair.find({ isActive: true })
      .sort({ publishedDate: -1, publishedTime: -1, createdAt: -1 })
      .lean();

    res.json(currentAffairs.map(formatCurrentAffair));
  } catch (error) {
    logger.error(error, 'Error fetching current affairs');
    res.status(500).json({ error: 'Failed to fetch current affairs' });
  }
});


// POST /jobs/sync-current-affairs
app.post('/jobs/sync-current-affairs', async (req: Request, res: Response) => {
  try {
    res.json({ message: 'AffairsCloud Current Affairs sync triggered' });
    AffairsCloudParser.syncAffairsCloud().catch((err: any) => logger.error({ error: err.message }, '⚠ Triggered AffairsCloud sync failed'));
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger sync' });
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
            <span class="badge">Tamil Categories</span>
            <span class="url">/api/v1/categories?language=Tamil</span>
            <span class="desc">Get all categories for Tamil news</span>
          </div>

          <div class="endpoint">
            <span class="badge">Kannada Categories</span>
            <span class="url">/api/v1/categories?language=Kannada</span>
            <span class="desc">Get all categories for Kannada news</span>
          </div>

          <div class="endpoint">
            <span class="badge">Malayalam Categories</span>
            <span class="url">/api/v1/categories?language=Malayalam</span>
            <span class="desc">Get all categories for Malayalam news</span>
          </div>

          <div class="endpoint">
            <span class="badge">Marathi Categories</span>
            <span class="url">/api/v1/categories?language=Marathi</span>
            <span class="desc">Get all categories for Marathi news</span>
          </div>

          <div class="endpoint">
            <span class="badge">Bengali Categories</span>
            <span class="url">/api/v1/categories?language=Bengali</span>
            <span class="desc">Get all categories for Bengali news</span>
          </div>

          <div class="endpoint">
            <span class="badge">Gujarati Categories</span>
            <span class="url">/api/v1/categories?language=Gujarati</span>
            <span class="desc">Get all categories for Gujarati news</span>
          </div>

          <div class="endpoint">
            <span class="badge">Punjabi Categories</span>
            <span class="url">/api/v1/categories?language=Punjabi</span>
            <span class="desc">Get all categories for Punjabi news</span>
          </div>

          <div class="endpoint">
            <span class="badge">Urdu Categories</span>
            <span class="url">/api/v1/categories?language=Urdu</span>
            <span class="desc">Get all categories for Urdu news</span>
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

          <div class="endpoint">
            <span class="badge">Tamil Articles</span>
            <span class="url">/api/v1/articles?language=Tamil</span>
            <span class="desc">Get all Tamil news articles</span>
          </div>

          <div class="endpoint">
            <span class="badge">Kannada Articles</span>
            <span class="url">/api/v1/articles?language=Kannada</span>
            <span class="desc">Get all Kannada news articles</span>
          </div>

          <div class="endpoint">
            <span class="badge">Malayalam Articles</span>
            <span class="url">/api/v1/articles?language=Malayalam</span>
            <span class="desc">Get all Malayalam news articles</span>
          </div>

          <div class="endpoint">
            <span class="badge">Marathi Articles</span>
            <span class="url">/api/v1/articles?language=Marathi</span>
            <span class="desc">Get all Marathi news articles</span>
          </div>

          <div class="endpoint">
            <span class="badge">Bengali Articles</span>
            <span class="url">/api/v1/articles?language=Bengali</span>
            <span class="desc">Get all Bengali news articles</span>
          </div>

          <div class="endpoint">
            <span class="badge">Gujarati Articles</span>
            <span class="url">/api/v1/articles?language=Gujarati</span>
            <span class="desc">Get all Gujarati news articles</span>
          </div>

          <div class="endpoint">
            <span class="badge">Punjabi Articles</span>
            <span class="url">/api/v1/articles?language=Punjabi</span>
            <span class="desc">Get all Punjabi news articles</span>
          </div>

          <div class="endpoint">
            <span class="badge">Urdu Articles</span>
            <span class="url">/api/v1/articles?language=Urdu</span>
            <span class="desc">Get all Urdu news articles</span>
          </div>

        </div>
      </div>
    </body>
    </html>
  `);
});

export default app;
