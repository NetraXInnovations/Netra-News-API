import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import { logger } from './config/logger';
import { z } from 'zod';
import { Article } from './models/Article';
import { Category } from './models/Category';

const app = express();

app.use(cors());
app.use(compression());
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url, ip: req.ip }, 'Incoming request');
  next();
});

const saveArticleSchema = z.object({
  article_id: z.string()
});

const sendResponse = (res: Response, statusCode: number, success: boolean, message: string, data: any = null) => {
  res.status(statusCode).json({
    success,
    message,
    timestamp: new Date().toISOString(),
    data
  });
};

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

app.get('/', (req: Request, res: Response) => {
  sendResponse(res, 200, true, 'Netra News API is running on MongoDB Atlas!');
});

// Cache variables
const cachedCategories: { [key: string]: any } = {};
const lastCategoriesFetch: { [key: string]: number } = {};
const CACHE_TTL = 5 * 60 * 1000;

app.get('/languages', asyncHandler(async (req: Request, res: Response) => {
  try {
    const cats = await Category.find({ enabled: true }).sort({ name: 1 }).lean();
    const uniqueLangs = new Set();
    const result: any[] = [];
    
    cats.forEach(c => {
      if (c.language && !uniqueLangs.has(c.language.toLowerCase())) {
        uniqueLangs.add(c.language.toLowerCase());
        result.push({
          language: c.language.toLowerCase(),
          name: c.language.charAt(0).toUpperCase() + c.language.slice(1)
        });
      }
    });
    
    sendResponse(res, 200, true, 'Languages retrieved successfully', result);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get languages');
    sendResponse(res, 500, false, `Failed to retrieve languages: ${error.message}`);
  }
}));

app.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  try {
    const langName = req.query.language as string;
    const cacheKey = langName ? langName.toLowerCase() : 'all';

    if (cachedCategories[cacheKey] && Date.now() - (lastCategoriesFetch[cacheKey] || 0) < CACHE_TTL) {
      return sendResponse(res, 200, true, 'Categories retrieved successfully', cachedCategories[cacheKey]);
    }

    const filter: any = { enabled: true };
    if (langName) {
      filter.language = new RegExp(`^${langName}$`, 'i');
    }

    let cats = await Category.find(filter).sort({ category: 1, name: 1 }).lean();
    
    cachedCategories[cacheKey] = cats;
    lastCategoriesFetch[cacheKey] = Date.now();

    sendResponse(res, 200, true, 'Categories retrieved successfully', cats);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get categories');
    sendResponse(res, 500, false, `Failed to retrieve categories: ${error.message}`);
  }
}));

async function fetchArticlesHelper(req: Request, res: Response, latestOnly: boolean) {
  const language = req.query.language as string;
  const category = req.query.category as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const filter: any = { isActive: true };
  if (language) filter.language = new RegExp(`^${language}$`, 'i');
  if (category) filter.category = new RegExp(`^${category}$`, 'i');

  const startIndex = latestOnly ? 0 : (page - 1) * limit;
  const fetchLimit = latestOnly ? 50 : limit;

  // Blazingly fast MongoDB query
  const articles = await Article.find(filter)
    .sort({ publishedDate: -1, publishedTime: -1 })
    .skip(startIndex)
    .limit(fetchLimit)
    .lean();

  const formattedArticles = articles.map(data => {
    let cleanText = data.content || '';
    if (cleanText) {
      cleanText = cleanText
        .split('\n\n')
        .map((p: string) => {
          let cleanPara = p.replace(/https?:\/\/[^\s]+/g, '');
          cleanPara = cleanPara.replace(/[\/\\]+/g, '');
          return cleanPara.trim();
        })
        .filter((p: string) => p.length > 0)
        .filter((p: string) => !p.includes('Photo Credit:'))
        .filter((p: string) => !p.includes('Published - '))
        .filter((p: string) => !p.includes('Get the latest'))
        .filter((p: string) => !p.includes('Download the TOI App'))
        .join('\n\n');
    }

    return {
      id: data.id,
      language: data.language,
      category: data.category,
      title: data.title,
      source_url: data.sourceUrl,
      published_date: data.publishedDate,
      published_time: data.publishedTime,
      reading_time: data.readingTime,
      is_saved: data.isSaved,
      content: cleanText
    };
  });

  sendResponse(res, 200, true, 'Articles retrieved successfully', formattedArticles);
}

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

app.get('/article/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await Article.findOne({ id, isActive: true }).lean();

    if (!data) {
      return sendResponse(res, 404, false, 'Article not found');
    }

    const formatted = {
      id: data.id,
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
    const articles = await Article.find({ isSaved: true })
      .sort({ savedAt: -1 })
      .lean();
    
    const formatted = articles.map(data => {
      let cleanText = data.content || '';
      if (cleanText) {
        cleanText = cleanText
          .split('\n\n')
          .map((p: string) => {
            let cleanPara = p.replace(/https?:\/\/[^\s]+/g, '');
            cleanPara = cleanPara.replace(/[\/\\]+/g, '');
            return cleanPara.trim();
          })
          .filter((p: string) => p.length > 0)
          .filter((p: string) => !p.includes('Photo Credit:'))
          .filter((p: string) => !p.includes('Published - '))
          .filter((p: string) => !p.includes('Get the latest'))
          .filter((p: string) => !p.includes('Download the TOI App'))
          .join('\n\n');
      }

      return {
        id: data.id,
        language: data.language,
        category: data.category,
        title: data.title,
        content: cleanText,
        source_url: data.sourceUrl,
        published_date: data.publishedDate,
        published_time: data.publishedTime,
        reading_time: data.readingTime,
        is_saved: true,
        saved_at: data.savedAt
      };
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
    
    const filter: any = { isCurrentAffairs: true, isActive: true };
    if (language) filter.language = new RegExp(`^${language}$`, 'i');

    const articles = await Article.find(filter)
      .sort({ publishedDate: -1, publishedTime: -1 })
      .limit(50)
      .lean();
    
    const formatted = articles.map((data: any) => {
      let cleanText = data.content || '';
      if (cleanText) {
        cleanText = cleanText
          .split('\n\n')
          .map((p: string) => {
            let cleanPara = p.replace(/https?:\/\/[^\s]+/g, '');
            cleanPara = cleanPara.replace(/[\/\\]+/g, '');
            return cleanPara.trim();
          })
          .filter((p: string) => p.length > 0)
          .filter((p: string) => !p.includes('Photo Credit:'))
          .filter((p: string) => !p.includes('Published - '))
          .filter((p: string) => !p.includes('Get the latest'))
          .filter((p: string) => !p.includes('Download the TOI App'))
          .join('\n\n');
      }

      return {
        id: data.id,
        language: data.language,
        category: data.category,
        title: data.title,
        source_url: data.sourceUrl,
        published_date: data.publishedDate,
        published_time: data.publishedTime,
        reading_time: data.readingTime,
        is_saved: data.isSaved,
        content: cleanText
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
    const article = await Article.findOneAndUpdate(
      { id: article_id },
      { isSaved: true, savedAt: new Date().toISOString() },
      { new: true }
    );

    if (!article) {
      return sendResponse(res, 404, false, 'Article not found');
    }

    sendResponse(res, 200, true, 'Article saved successfully');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to save article');
    sendResponse(res, 500, false, 'Failed to save article');
  }
}));

app.post('/unsave', asyncHandler(async (req: Request, res: Response) => {
  try {
    const parseResult = saveArticleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendResponse(res, 400, false, 'Invalid format for article_id', parseResult.error.format());
    }

    const { article_id } = parseResult.data;
    const article = await Article.findOneAndUpdate(
      { id: article_id },
      { isSaved: false, savedAt: null },
      { new: true }
    );

    if (!article) {
      return sendResponse(res, 404, false, 'Article not found');
    }

    sendResponse(res, 200, true, 'Article unsaved successfully');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to unsave article');
    sendResponse(res, 500, false, 'Failed to unsave article');
  }
}));

// Fallback logic inside the route handler, not global handler to avoid 500 errors when no handler found
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

export default app;
