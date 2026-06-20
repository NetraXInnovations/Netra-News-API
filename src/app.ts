import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import { db } from './db/db';
import { logger } from './config/logger';
import { CleanupService } from './services/cleanupService';
import { RssIngestionService } from './services/rssIngestionService';
import { z } from 'zod';

const app = express();

// Standard Middlewares
app.use(cors());
app.use(compression());
app.use(express.json());

// Log incoming requests
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url, ip: req.ip }, 'Incoming request');
  next();
});

// Zod Schema validations
const saveArticleSchema = z.object({
  article_id: z.string().uuid()
});

// Standard Response Formatter Helper
const sendResponse = (res: Response, statusCode: number, success: boolean, message: string, data: any = null) => {
  res.status(statusCode).json({
    success,
    message,
    timestamp: new Date().toISOString(),
    data
  });
};

// --- API ROUTES ---

// Root route - API welcome response
app.get('/', (req: Request, res: Response) => {
  sendResponse(res, 200, true, 'Welcome to Netra News Hub API', {
    name: 'Netra News Hub API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      stats: '/stats',
      languages: '/languages',
      categories: '/categories',
      articles: '/articles',
      articles_latest: '/articles/latest',
      article_detail: '/article/:id',
      saved_articles: '/saved',
      save_article: '/save',
      current_affairs: '/current-affairs'
    }
  });
});

// 1. GET /health
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Quick db ping test
    await db.query('SELECT 1');
    sendResponse(res, 200, true, 'Healthy database connection');
  } catch (error: any) {
    sendResponse(res, 500, false, 'Unhealthy database connection', { error: error.message });
  }
});

// 2. GET /stats
app.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await CleanupService.getLatestStats();
    sendResponse(res, 200, true, 'Statistics retrieved successfully', stats);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get stats');
    sendResponse(res, 500, false, 'Failed to retrieve statistics');
  }
});

// Caching variables for static dictionaries
let cachedLanguages: any = null;
let lastLanguagesFetch = 0;
let cachedCategories: Record<string, any> = {};
let lastCategoriesFetch: Record<string, number> = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// 3. GET /languages
app.get('/languages', async (req: Request, res: Response) => {
  try {
    if (cachedLanguages && Date.now() - lastLanguagesFetch < CACHE_TTL) {
      return sendResponse(res, 200, true, 'Languages retrieved successfully', cachedLanguages);
    }
    const result = await db.query('SELECT id, name, code, enabled FROM languages WHERE enabled = true ORDER BY name');
    cachedLanguages = result.rows;
    lastLanguagesFetch = Date.now();
    sendResponse(res, 200, true, 'Languages retrieved successfully', result.rows);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get languages');
    sendResponse(res, 500, false, 'Failed to retrieve languages');
  }
});

// 4. GET /categories
// Supports ?language=english, ?language=telugu, etc.
app.get('/categories', async (req: Request, res: Response) => {
  try {
    const langName = req.query.language as string;
    const cacheKey = langName || 'all';

    if (cachedCategories[cacheKey] && Date.now() - (lastCategoriesFetch[cacheKey] || 0) < CACHE_TTL) {
      return sendResponse(res, 200, true, 'Categories retrieved successfully', cachedCategories[cacheKey]);
    }

    let queryText = 'SELECT c.id, c.name, c.enabled, l.name as language FROM categories c JOIN languages l ON c.language_id = l.id WHERE c.enabled = true';
    const queryParams: any[] = [];

    if (langName) {
      queryText += ' AND LOWER(l.name) = LOWER($1)';
      queryParams.push(langName);
    }

    queryText += ' ORDER BY c.name';
    const result = await db.query(queryText, queryParams);
    
    cachedCategories[cacheKey] = result.rows;
    lastCategoriesFetch[cacheKey] = Date.now();

    sendResponse(res, 200, true, 'Categories retrieved successfully', result.rows);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get categories');
    sendResponse(res, 500, false, 'Failed to retrieve categories');
  }
});

// 5. GET /articles and GET /articles/latest
// Filters supported: ?language=english, ?category=technology
app.get('/articles', async (req: Request, res: Response) => {
  try {
    await fetchArticlesHelper(req, res, false);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch articles');
    sendResponse(res, 500, false, 'Failed to fetch articles');
  }
});

app.get('/articles/latest', async (req: Request, res: Response) => {
  try {
    await fetchArticlesHelper(req, res, true);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch latest articles');
    sendResponse(res, 500, false, 'Failed to fetch latest articles');
  }
});

// Helper for article fetching
async function fetchArticlesHelper(req: Request, res: Response, latestOnly: boolean) {
  const language = req.query.language as string;
  const category = req.query.category as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  let queryText = `
    SELECT 
      a.id,
      l.name as language,
      c.name as category,
      a.title,
      a.source_url,
      a.published_at,
      a.created_at,
      a.reading_time,
      a.is_saved,
      a.is_active,
      to_char(a.published_at, 'YYYY-MM-DD') as published_date,
      to_char(a.published_at, 'HH24:MI:SS') as published_time
    FROM articles a
    JOIN languages l ON a.language_id = l.id
    JOIN categories c ON a.category_id = c.id
    WHERE a.is_active = true AND a.is_current_affairs = false
  `;
  const queryParams: any[] = [];
  let paramCount = 1;

  if (language) {
    queryText += ` AND LOWER(l.name) = LOWER($${paramCount})`;
    queryParams.push(language);
    paramCount++;
  }

  if (category) {
    queryText += ` AND LOWER(c.name) = LOWER($${paramCount})`;
    queryParams.push(category);
    paramCount++;
  }

  if (latestOnly) {
    queryText += ' ORDER BY a.published_at DESC LIMIT 50';
  } else {
    queryText += ` ORDER BY a.published_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit);
    queryParams.push((page - 1) * limit);
  }

  const result = await db.query(queryText, queryParams);
  
  // Accessibility format mapping
  const formattedArticles = result.rows.map(row => ({
    id: row.id,
    language: row.language,
    category: row.category,
    title: row.title,
    source_url: row.source_url,
    published_date: row.published_date,
    published_time: row.published_time,
    reading_time: row.reading_time,
    is_saved: row.is_saved
  }));

  sendResponse(res, 200, true, 'Articles retrieved successfully', formattedArticles);
}

// 6. GET /article/:id
app.get('/article/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const queryText = `
      SELECT 
        a.id,
        l.name as language,
        c.name as category,
        a.title,
        a.content,
        a.source_url,
        a.published_at,
        a.created_at,
        a.reading_time,
        a.is_saved,
        a.is_active,
        to_char(a.published_at, 'YYYY-MM-DD') as published_date,
        to_char(a.published_at, 'HH24:MI:SS') as published_time
      FROM articles a
      JOIN languages l ON a.language_id = l.id
      JOIN categories c ON a.category_id = c.id
      WHERE a.id = $1 AND a.is_active = true
    `;
    const result = await db.query(queryText, [id]);

    if (result.rows.length === 0) {
      return sendResponse(res, 404, false, 'Article not found');
    }

    const row = result.rows[0];
    const formatted = {
      id: row.id,
      language: row.language,
      category: row.category,
      title: row.title,
      content: row.content,
      source_url: row.source_url,
      published_date: row.published_date,
      published_time: row.published_time,
      reading_time: row.reading_time,
      is_saved: row.is_saved
    };

    sendResponse(res, 200, true, 'Article retrieved successfully', formatted);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get article by ID');
    sendResponse(res, 500, false, 'Failed to retrieve article');
  }
});

// 7. GET /saved
app.get('/saved', async (req: Request, res: Response) => {
  try {
    const queryText = `
      SELECT 
        a.id,
        l.name as language,
        c.name as category,
        a.title,
        a.content,
        a.source_url,
        a.published_at,
        a.reading_time,
        true as is_saved,
        to_char(a.published_at, 'YYYY-MM-DD') as published_date,
        to_char(a.published_at, 'HH24:MI:SS') as published_time,
        s.saved_at
      FROM saved_articles s
      JOIN articles a ON s.article_id = a.id
      JOIN languages l ON a.language_id = l.id
      JOIN categories c ON a.category_id = c.id
      ORDER BY s.saved_at DESC
    `;
    const result = await db.query(queryText);
    const formatted = result.rows.map(row => ({
      id: row.id,
      language: row.language,
      category: row.category,
      title: row.title,
      content: row.content,
      source_url: row.source_url,
      published_date: row.published_date,
      published_time: row.published_time,
      reading_time: row.reading_time,
      is_saved: true,
      saved_at: row.saved_at
    }));

    sendResponse(res, 200, true, 'Saved articles retrieved successfully', formatted);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch saved articles');
    sendResponse(res, 500, false, 'Failed to fetch saved articles');
  }
});

// 7.5 GET /current-affairs
app.get('/current-affairs', async (req: Request, res: Response) => {
  try {
    const language = req.query.language as string;
    
    let queryText = `
      SELECT 
        a.id,
        a.title,
        to_char(a.published_at, 'YYYY-MM-DD') as published_date,
        to_char(a.published_at, 'HH12:MI AM') as published_time,
        a.content,
        a.summary
      FROM articles a
      JOIN languages l ON a.language_id = l.id
      WHERE a.is_active = true AND a.is_current_affairs = true
    `;
    const queryParams: any[] = [];
    
    if (language) {
      queryText += ' AND LOWER(l.name) = LOWER($1)';
      queryParams.push(language);
    }
    
    queryText += ' ORDER BY a.published_at DESC LIMIT 50';
    
    const result = await db.query(queryText, queryParams);
    
    const formatted = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      date: row.published_date,
      time: row.published_time,
      content: row.content.split('\n\n').map((p: string) => p.trim()).filter((p: string) => p.length > 0),
      summary: row.summary || ''
    }));
    
    sendResponse(res, 200, true, 'Current affairs retrieved successfully', formatted);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch current affairs');
    sendResponse(res, 500, false, 'Failed to fetch current affairs');
  }
});

// 8. POST /save
app.post('/save', async (req: Request, res: Response) => {
  try {
    const parseResult = saveArticleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendResponse(res, 400, false, 'Invalid UUID format for article_id', parseResult.error.format());
    }

    const { article_id } = parseResult.data;

    // Check if article exists
    const articleCheck = await db.query('SELECT 1 FROM articles WHERE id = $1', [article_id]);
    if (articleCheck.rows.length === 0) {
      return sendResponse(res, 404, false, 'Article not found');
    }

    // Insert into saved_articles and update articles.is_saved
    await db.query(
      'INSERT INTO saved_articles (article_id) VALUES ($1) ON CONFLICT (article_id) DO NOTHING',
      [article_id]
    );
    await db.query('UPDATE articles SET is_saved = true WHERE id = $1', [article_id]);

    sendResponse(res, 200, true, 'Article saved successfully');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to save article');
    sendResponse(res, 500, false, 'Failed to save article');
  }
});

// 9. DELETE /save
// Supports receiving article_id either in request body or query parameter or URL path
app.delete('/save', async (req: Request, res: Response) => {
  try {
    const articleIdRaw = req.body.article_id || req.query.article_id;
    
    const parseResult = saveArticleSchema.safeParse({ article_id: articleIdRaw });
    if (!parseResult.success) {
      return sendResponse(res, 400, false, 'Invalid UUID format for article_id');
    }

    const { article_id } = parseResult.data;

    // Remove from saved_articles and update articles.is_saved
    const deleteRes = await db.query('DELETE FROM saved_articles WHERE article_id = $1', [article_id]);
    await db.query('UPDATE articles SET is_saved = false WHERE id = $1', [article_id]);

    if (deleteRes.rowCount && deleteRes.rowCount > 0) {
      sendResponse(res, 200, true, 'Article removed from saved successfully');
    } else {
      sendResponse(res, 404, false, 'Article was not saved or not found');
    }
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to remove saved article');
    sendResponse(res, 500, false, 'Failed to remove saved article');
  }
});

// Trigger Manual Sync & Cleanup Endpoints for easier dev/ops testing
app.post('/jobs/sync', async (req: Request, res: Response) => {
  try {
    // Run async sync job so it doesn't block the API
    RssIngestionService.syncAllFeeds().catch(err => logger.error({ err }, 'Async sync job failed'));
    sendResponse(res, 202, true, 'RSS ingestion job triggered in the background');
  } catch (error: any) {
    sendResponse(res, 500, false, 'Failed to trigger RSS sync job');
  }
});

app.post('/jobs/cleanup', async (req: Request, res: Response) => {
  try {
    const stats = await CleanupService.runCleanup();
    sendResponse(res, 200, true, 'Database cleanup completed successfully', stats);
  } catch (error: any) {
    sendResponse(res, 500, false, 'Failed to run cleanup job');
  }
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err }, 'Unhandled request error');
  sendResponse(res, 500, false, 'Internal Server Error');
});

export default app;
