import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import { db } from './db/db';
import { logger } from './config/logger';
import { CleanupService } from './services/cleanupService';
import { RssIngestionService } from './services/rssIngestionService';
import { z } from 'zod';

const app = express();

app.use(cors());
app.use(compression());
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url, ip: req.ip }, 'Incoming request');
  next();
});

const saveArticleSchema = z.object({
  article_id: z.string() // Firestore IDs are standard strings, not necessarily UUIDs
});

const sendResponse = (res: Response, statusCode: number, success: boolean, message: string, data: any = null) => {
  res.status(statusCode).json({
    success,
    message,
    timestamp: new Date().toISOString(),
    data
  });
};

// Async Handler to catch unhandled promise rejections in Express routes
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

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

app.get('/health', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Ping Firestore
    await db.collection('languages').limit(1).get();
    sendResponse(res, 200, true, 'Healthy database connection');
  } catch (error: any) {
    sendResponse(res, 500, false, 'Unhealthy database connection', { error: error.message });
  }
}));

app.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const stats = await CleanupService.getLatestStats();
    sendResponse(res, 200, true, 'Statistics retrieved successfully', stats);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get stats');
    sendResponse(res, 500, false, 'Failed to retrieve statistics');
  }
}));

let cachedLanguages: any = null;
let lastLanguagesFetch = 0;
let cachedCategories: Record<string, any> = {};
let lastCategoriesFetch: Record<string, number> = {};
const CACHE_TTL = 24 * 60 * 60 * 1000;

app.get('/languages', asyncHandler(async (req: Request, res: Response) => {
  try {
    if (cachedLanguages && Date.now() - lastLanguagesFetch < CACHE_TTL) {
      return sendResponse(res, 200, true, 'Languages retrieved successfully', cachedLanguages);
    }
    const snapshot = await db.collection('languages').where('enabled', '==', true).get();
    const langs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name));
    
    cachedLanguages = langs;
    lastLanguagesFetch = Date.now();
    sendResponse(res, 200, true, 'Languages retrieved successfully', langs);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get languages');
    sendResponse(res, 500, false, 'Failed to retrieve languages');
  }
}));

app.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  try {
    const langName = req.query.language as string;
    const cacheKey = langName ? langName.toLowerCase() : 'all';

    if (cachedCategories[cacheKey] && Date.now() - (lastCategoriesFetch[cacheKey] || 0) < CACHE_TTL) {
      return sendResponse(res, 200, true, 'Categories retrieved successfully', cachedCategories[cacheKey]);
    }

    let query: FirebaseFirestore.Query = db.collection('categories').where('enabled', '==', true);
    const snapshot = await query.get();
    let cats = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    if (langName) {
      cats = cats.filter((c: any) => c.language && c.language.toLowerCase() === langName.toLowerCase());
    }
    cats = cats.sort((a: any, b: any) => (a.category || a.name).localeCompare(b.category || b.name));
    
    cachedCategories[cacheKey] = cats;
    lastCategoriesFetch[cacheKey] = Date.now();

    sendResponse(res, 200, true, 'Categories retrieved successfully', cats);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get categories');
    sendResponse(res, 500, false, `Failed to retrieve categories: ${error.message}`);
  }
}));

app.get('/articles', asyncHandler(async (req: Request, res: Response) => {
  try {
    await fetchArticlesHelper(req, res, false);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch articles');
    sendResponse(res, 500, false, `Failed to fetch articles: ${error.message}`);
  }
}));

app.get('/articles/latest', asyncHandler(async (req: Request, res: Response) => {
  try {
    await fetchArticlesHelper(req, res, true);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch latest articles');
    sendResponse(res, 500, false, `Failed to fetch latest articles: ${error.message}`);
  }
}));

async function fetchArticlesHelper(req: Request, res: Response, latestOnly: boolean) {
  const language = req.query.language as string;
  const category = req.query.category as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  let query: FirebaseFirestore.Query = db.collection('articles')
    .select('language', 'category', 'title', 'content', 'sourceUrl', 'publishedDate', 'publishedTime', 'readingTime', 'isSaved');

  if (language) {
    query = query.where('language', '==', language.toLowerCase());
  }
  if (category) {
    query = query.where('category', '==', category.toLowerCase());
  }

  // Fetch matching documents
  const snapshot = await query.get();
  
  // Sort in memory to bypass Firestore Composite Index requirements
  let allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
  
  allDocs.sort((a, b) => {
    const timeA = new Date(`${a.publishedDate}T${a.publishedTime || '00:00:00'}`).getTime();
    const timeB = new Date(`${b.publishedDate}T${b.publishedTime || '00:00:00'}`).getTime();
    return timeB - timeA;
  });

  // Apply Pagination locally
  const startIndex = latestOnly ? 0 : (page - 1) * limit;
  const endIndex = latestOnly ? 50 : startIndex + limit;
  const paginatedDocs = allDocs.slice(startIndex, endIndex);

  const formattedArticles = paginatedDocs.map(data => ({
    id: data.id,
    language: data.language,
    category: data.category,
    title: data.title,
    content: data.content ? data.content.split('\n\n').map((p: string) => p.trim()).filter((p: string) => p.length > 0) : [],
    source_url: data.sourceUrl,
    published_date: data.publishedDate,
    published_time: data.publishedTime,
    reading_time: data.readingTime,
    is_saved: data.isSaved
  }));

  sendResponse(res, 200, true, 'Articles retrieved successfully', formattedArticles);
}

app.get('/article/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('articles').doc(id).get();

    if (!doc.exists) {
      return sendResponse(res, 404, false, 'Article not found');
    }

    const data = doc.data() as any;
    if (!data.isActive) {
      return sendResponse(res, 404, false, 'Article not found');
    }

    const formatted = {
      id: doc.id,
      language: data.language,
      category: data.category,
      title: data.title,
      content: data.content,
      source_url: data.sourceUrl,
      published_date: data.publishedDate,
      published_time: data.publishedTime,
      reading_time: data.readingTime,
      is_saved: data.isSaved
    };

    sendResponse(res, 200, true, 'Article retrieved successfully', formatted);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get article by ID');
    sendResponse(res, 500, false, 'Failed to retrieve article');
  }
}));

app.get('/saved', asyncHandler(async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('articles').where('isSaved', '==', true).get();
    
    const formatted = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        language: data.language,
        category: data.category,
        title: data.title,
        content: data.content,
        source_url: data.sourceUrl,
        published_date: data.publishedDate,
        published_time: data.publishedTime,
        reading_time: data.readingTime,
        is_saved: true,
        saved_at: data.savedAt
      };
    });

    // In-memory sort by savedAt desc
    formatted.sort((a: any, b: any) => {
       const da = a.saved_at ? new Date(a.saved_at).getTime() : 0;
       const dbTime = b.saved_at ? new Date(b.saved_at).getTime() : 0;
       return dbTime - da;
    });

    sendResponse(res, 200, true, 'Saved articles retrieved successfully', formatted);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch saved articles');
    sendResponse(res, 500, false, 'Failed to fetch saved articles');
  }
}));

app.get('/current-affairs', asyncHandler(async (req: Request, res: Response) => {
  try {
    const language = req.query.language as string;
    
    let query: FirebaseFirestore.Query = db.collection('articles')
      .where('isCurrentAffairs', '==', true);
      
    if (language) {
      query = query.where('language', '==', language.toLowerCase());
    }
    
    const snapshot = await query.get();
    
    let allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    allDocs.sort((a, b) => {
      const timeA = new Date(`${a.publishedDate}T${a.publishedTime || '00:00:00'}`).getTime();
      const timeB = new Date(`${b.publishedDate}T${b.publishedTime || '00:00:00'}`).getTime();
      return timeB - timeA;
    });

    const paginatedDocs = allDocs.slice(0, 50);
    
    const formatted = paginatedDocs.map((data: any) => {
      return {
        id: data.id,
        title: data.title,
        date: data.publishedDate,
        time: data.publishedTime,
        content: data.content.split('\\n\\n').map((p: string) => p.trim()).filter((p: string) => p.length > 0),
        summary: data.summary || ''
      };
    });
    
    sendResponse(res, 200, true, 'Current affairs retrieved successfully', formatted);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch current affairs');
    sendResponse(res, 500, false, 'Failed to fetch current affairs');
  }
}));

app.post('/save', asyncHandler(async (req: Request, res: Response) => {
  try {
    const parseResult = saveArticleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendResponse(res, 400, false, 'Invalid format for article_id', parseResult.error.format());
    }

    const { article_id } = parseResult.data;
    const docRef = db.collection('articles').doc(article_id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendResponse(res, 404, false, 'Article not found');
    }

    await docRef.update({ 
      isSaved: true,
      savedAt: new Date().toISOString()
    });

    sendResponse(res, 200, true, 'Article saved successfully');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to save article');
    sendResponse(res, 500, false, 'Failed to save article');
  }
}));

app.delete('/save', asyncHandler(async (req: Request, res: Response) => {
  try {
    const articleIdRaw = req.body.article_id || req.query.article_id;
    
    const parseResult = saveArticleSchema.safeParse({ article_id: articleIdRaw });
    if (!parseResult.success) {
      return sendResponse(res, 400, false, 'Invalid format for article_id');
    }

    const { article_id } = parseResult.data;
    const docRef = db.collection('articles').doc(article_id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return sendResponse(res, 404, false, 'Article not found');
    }
    
    const data = doc.data();
    if (!data?.isSaved) {
      return sendResponse(res, 404, false, 'Article was not saved or not found');
    }

    await docRef.update({ 
      isSaved: false,
      savedAt: null
    });

    sendResponse(res, 200, true, 'Article removed from saved successfully');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to remove saved article');
    sendResponse(res, 500, false, 'Failed to remove saved article');
  }
}));

app.post('/jobs/sync', asyncHandler(async (req: Request, res: Response) => {
  try {
    RssIngestionService.syncAllFeeds().catch(err => logger.error({ err }, 'Async sync job failed'));
    sendResponse(res, 202, true, 'RSS ingestion job triggered in the background');
  } catch (error: any) {
    sendResponse(res, 500, false, 'Failed to trigger RSS sync job');
  }
}));

app.post('/jobs/cleanup', asyncHandler(async (req: Request, res: Response) => {
  try {
    const stats = await CleanupService.runCleanup();
    sendResponse(res, 200, true, 'Database cleanup completed successfully', stats);
  } catch (error: any) {
    sendResponse(res, 500, false, 'Failed to run cleanup job');
  }
}));

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled request error');
  sendResponse(res, 500, false, 'Internal Server Error');
});

export default app;
