import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { logger } from './config/logger';

import { Language } from './models/Language';
import { Category } from './models/Category';
import { Article } from './models/Article';
import { RssSource } from './models/RssSource';
import { SavedArticle } from './models/SavedArticle';
import { CurrentAffair } from './models/CurrentAffair';
import { AffairsCloudParser } from './services/affairsCloudParser';
import { RssIngestionService } from './services/rssIngestionService';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Cleans stored content at response time — Regex + Line filter (covers all languages)
const cleanStoredContent = (text: string): string => {
  if (!text) return '';

  // === REGEX pass — remove inline boilerplate patterns ===
  const BOILERPLATE_REGEXES = [
    /•?\s*reported\s*by\s*:?\s*.{0,80}/gi,
    /•?\s*published\s*by\s*:?\s*.{0,80}/gi,
    /•?\s*edited\s*by\s*:?\s*.{0,80}/gi,
    /•?\s*written\s*by\s*:?\s*.{0,80}/gi,
    /•?\s*local18\s*/gi,
    /last\s*updated\s*:?\s*.{0,100}/gi,
    /first\s*published\s*:?\s*.{0,100}/gi,
    /published\s*[-–]\s*.{0,100}ist/gi,
    /updated\s*[-–]\s*.{0,100}ist/gi,
    /location\s*:\s*\n?.{0,100}/gi,
    /photo\s*credit\s*:?\s*.{0,80}/gi,
    /image\s*credit\s*:?\s*.{0,80}/gi,
    /image\s*source\s*:?\s*.{0,80}/gi,
    /\d{1,2}:\d{2}\s*(am|pm)\s*ist/gi,
    /[a-z]+ \d{1,2}, \d{4} \d{1,2}:\d{2} (am|pm) ist/gi,
  ];

  let cleaned = text;
  for (const re of BOILERPLATE_REGEXES) {
    cleaned = cleaned.replace(re, '');
  }

  // === LINE-BY-LINE pass ===
  const lines = cleaned.split('\n').map(l => l.trim()).filter(line => {
    if (!line) return false;
    const l = line.toLowerCase();

    if (l.startsWith('reported by') || l.startsWith('• reported by')) return false;
    if (l.startsWith('published by') || l.startsWith('• published by')) return false;
    if (l.startsWith('edited by') || l.startsWith('written by')) return false;
    if (l.startsWith('last updated') || l.startsWith('first published')) return false;
    if (l.startsWith('location :') || l.startsWith('location:')) return false;
    if (l.startsWith('photo credit') || l.startsWith('image credit') || l.startsWith('image source')) return false;
    if (l === 'local18' || l === 'news18' || l === 'news18-telugu' || l === 'ndtv' || l === 'abp live') return false;
    if (l.startsWith('news18-') || l.startsWith('abp') || l.startsWith('zee news')) return false;

    // Telugu "also read" and related article prompts
    if (l.startsWith('ఇవి కూడా చదవండి') || l.startsWith('ఇవి కూడా చదవండి:')) return false;
    if (l.startsWith('కూడా చదవండి') || l.startsWith('మరిన్ని చదవండి')) return false;
    // Hindi also-read
    if (l.startsWith('यह भी पढ़ें') || l.startsWith('यह भी पढ़िए')) return false;
    // Tamil
    if (l.startsWith('இதையும் படிக்கலாம்') || l.startsWith('மேலும் படிக்க')) return false;
    // Malayalam
    if (l.startsWith('ഇതും വായിക്കാം') || l.startsWith('കൂടുതൽ വായിക്കുക')) return false;
    // Kannada
    if (l.startsWith('ಇದನ್ನೂ ಓದಿ') || l.startsWith('ಮತ್ತಷ್ಟು ಓದಿ')) return false;
    // Bengali
    if (l.startsWith('আরও পড়ুন') || l.startsWith('এটিও পড়ুন')) return false;

    // Twitter/X embed lines
    if (l.includes('pic.twitter.com/') || l.includes('twitter.com/') || l.includes('t.co/')) return false;
    if (l.startsWith('— ') && l.includes('@') && l.includes(')')) return false; // "— Username (@handle) July 16, 2026"
    if (l.match(/^— .+\(@.+\) .+\d{4}$/)) return false; // Twitter attribution

    // All language breadcrumbs
    if (l.includes('వార్తలు/') || l.includes('తెలుగు వార్తలు')) return false;
    if (l.includes('समाचार/') || l.includes('ख़बरें/')) return false;
    if (l.includes('সংবাদ/') || l.includes('খবর/')) return false;
    if (l.includes('செய்திகள்/') || l.includes('தமிழ் செய்திகள்')) return false;
    if (l.includes('వాతలు/') || l.includes(' వార్తలు/')) return false;
    if (l.includes('news/') && (l.match(/\//g) || []).length >= 2) return false;

    // Date/time lines with year
    if (l.includes('am ist') || l.includes('pm ist')) return false;

    // Boilerplate phrases
    if (l.includes('subscribe to our newsletter')) return false;
    if (l.includes('read more:') || l.includes('also read:')) return false;
    if (l.includes('copyright ©') || l.includes('all rights reserved')) return false;
    if (l.includes('follow us on') || l.includes('share this story') || l.includes('share this article')) return false;
    if (l.includes('advertisement') || l.includes('click here for more')) return false;
    if (l.includes('read all the latest news')) return false;

    return true;
  });

  return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
};

// Converts stored UTC HH:MM time to IST 12-hour AM/PM format
const toISTTime = (utcTimeStr: string): string => {
  if (!utcTimeStr) return '';
  // If already in AM/PM format, return as-is
  if (utcTimeStr.includes('AM') || utcTimeStr.includes('PM')) return utcTimeStr;
  const parts = utcTimeStr.split(':');
  if (parts.length < 2) return utcTimeStr;
  const utcHours = parseInt(parts[0], 10);
  const utcMinutes = parseInt(parts[1], 10);
  const totalMinutes = utcHours * 60 + utcMinutes + 330; // +5:30 IST
  const istHours24 = Math.floor(totalMinutes / 60) % 24;
  const istMins = totalMinutes % 60;
  const ampm = istHours24 >= 12 ? 'PM' : 'AM';
  const h12 = istHours24 % 12 || 12;
  const mm = istMins < 10 ? '0' + istMins : istMins;
  return `${h12}:${mm} ${ampm}`;
};

// Helper to format article response
const formatArticle = (doc: any) => ({
  id: doc._id.toString(),
  title: doc.title,
  publishedDate: doc.publishedDate || '',
  publishedTime: toISTTime(doc.publishedTime || ''),
  language: doc.language,
  category: doc.category,
  content: cleanStoredContent(doc.content || ''),
  sourceName: doc.sourceName,
  sourceUrl: doc.sourceUrl
});

// GET /api/v1/languages
app.get('/api/v1/languages', async (req: Request, res: Response) => {
  try {
    const langs = await Language.find({ enabled: true }).sort({ name: 1 }).lean();
    res.json(langs.map(l => ({
      name:      l.name,        // Display name  e.g. "Telugu"
      code:      l.code,        // ISO code       e.g. "te"
      useInApi:  l.name         // Use THIS value in ?language= param
    })));
  } catch (error) {
    logger.error(error, 'Error fetching languages');
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
});

// Helper: resolve ?language= param — accepts full name OR ISO code
// e.g. "Telugu" -> "Telugu", "te" -> "Telugu", "hi" -> "Hindi"
async function resolveLanguageName(param: string): Promise<string> {
  // If it looks like an ISO code (2-3 chars), look up by code first
  if (param.length <= 3) {
    const byCode = await Language.findOne({ code: param.toLowerCase() }).lean();
    if (byCode) return byCode.name;
  }
  // Otherwise use as-is (full name like "Telugu")
  return param;
}

// GET /api/v1/categories
app.get('/api/v1/categories', async (req: Request, res: Response) => {
  try {
    const { language } = req.query;
    if (!language) {
      return res.status(400).json({ error: 'language parameter is required. Use name (e.g. Telugu) or code (e.g. te)' });
    }
    // Resolve code -> name so both ?language=te and ?language=Telugu work
    const languageName = await resolveLanguageName(language as string);
    const cats = await Category.find({ language: languageName, enabled: true }).sort({ name: 1 }).lean();

    // Return native name + stable categoryId for filtering
    res.json(cats.map(c => ({
      name:        c.name,
      categoryId:  c.categoryId || '',
      englishName: c.englishName || ''
    })));
  } catch (error) {
    logger.error(error, 'Error fetching categories');
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/v1/articles
app.get('/api/v1/articles', async (req: Request, res: Response) => {
  try {
    const { language, category, categoryId, page = '1', limit = '20' } = req.query;
    const pageNum  = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100); // cap at 100

    const query: any = { isActive: true };
    if (language) {
      // Accept both full name (Telugu) and ISO code (te)
      query.language = await resolveLanguageName(language as string);
    }
    // categoryId (stable slug) takes priority; fall back to native-script category name
    if (categoryId) query.categoryId = categoryId;
    else if (category) query.category = category;

    let articles = await Article.find(query)
      .sort({ publishedDate: -1, publishedTime: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    // Never return empty: if page 1 has 0 results, trigger a background sync
    // and wait up to 8s for it to produce new articles before responding.
    if (articles.length === 0 && pageNum === 1) {
      logger.warn(
        { query },
        '⚠ Query returned 0 articles — triggering emergency background sync'
      );
      try {
        // Fire sync and give it 8 seconds to insert at least something
        await Promise.race([
          RssIngestionService.syncAllFeeds(),
          new Promise(resolve => setTimeout(resolve, 8000))
        ]);
        // Re-query after sync
        articles = await Article.find(query)
          .sort({ publishedDate: -1, publishedTime: -1 })
          .limit(limitNum)
          .lean();
        logger.info(
          { count: articles.length },
          `✅ Post-sync re-query returned ${articles.length} articles`
        );
      } catch (syncErr: any) {
        logger.error({ reason: syncErr.message }, '⚠ Emergency sync failed');
      }
    }

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

// GET /api/v1/system/health
// Admin endpoint — shows sync status, per-language article counts, and per-feed health.
app.get('/api/v1/system/health', async (req: Request, res: Response) => {
  try {
    const [totalArticles, languageCounts, feeds] = await Promise.all([
      Article.countDocuments({}),
      Article.aggregate([
        { $group: { _id: '$language', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      RssSource.find({}, {
        sourceName: 1, language: 1, category: 1, categoryId: 1,
        status: 1, lastSuccessAt: 1, lastFailureAt: 1,
        consecutiveFailures: 1, lastItemCount: 1
      }).sort({ language: 1, sourceName: 1 }).lean()
    ]);

    // Most recent successful sync across all feeds
    const latestSuccess = feeds
      .filter(f => f.lastSuccessAt)
      .map(f => f.lastSuccessAt as Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    const failingFeeds = feeds.filter(f => f.status === 'FAILING' || (f.consecutiveFailures && f.consecutiveFailures > 0));

    res.json({
      totalArticles,
      lastSyncSuccess: latestSuccess,
      languageCounts:  Object.fromEntries(languageCounts.map((l: any) => [l._id, l.count])),
      failingFeedsCount: failingFeeds.length,
      feeds: feeds.map((f: any) => ({
        name:               f.sourceName,
        language:           f.language,
        category:           f.category,
        categoryId:         f.categoryId,
        status:             f.status || 'UNKNOWN',
        lastSuccessAt:      f.lastSuccessAt || null,
        lastFailureAt:      f.lastFailureAt || null,
        consecutiveFailures: f.consecutiveFailures || 0,
        lastItemCount:      f.lastItemCount || 0
      }))
    });
  } catch (error) {
    logger.error(error, 'Error fetching system health');
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

// --- CURRENT AFFAIRS API ---

// GET /api/v1/current-affairs
// Returns a list of daily issues (light card view — no sections/articles payload)
app.get('/api/v1/current-affairs', async (req: Request, res: Response) => {
  try {
    const issues = await CurrentAffair.find()
      .sort({ issueDate: -1 })
      .select('issueDate publishedTime totalTopics estimatedReadingTime')
      .lean();

    res.json(issues.map((doc: any) => ({
      id:                   doc._id.toString(),
      issueDate:            doc.issueDate,
      publishedTime:        doc.publishedTime,
      totalTopics:          doc.totalTopics,
      estimatedReadingTime: doc.estimatedReadingTime,
    })));
  } catch (error) {
    logger.error(error, 'Error fetching current affairs list');
    res.status(500).json({ error: 'Failed to fetch current affairs' });
  }
});

// GET /api/v1/current-affairs/:issueDate
// Returns a full daily issue with all sections and articles (e.g. /api/v1/current-affairs/2026-07-14)
app.get('/api/v1/current-affairs/:issueDate', async (req: Request, res: Response) => {
  try {
    const issue = await CurrentAffair.findOne({ issueDate: req.params.issueDate }).lean() as any;
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    res.json({
      id:                   issue._id.toString(),
      issueDate:            issue.issueDate,
      publishedTime:        issue.publishedTime,
      totalTopics:          issue.totalTopics,
      estimatedReadingTime: issue.estimatedReadingTime,
      sections:             issue.sections,
    });
  } catch (error) {
    logger.error(error, 'Error fetching current affairs issue');
    res.status(500).json({ error: 'Failed to fetch current affairs issue' });
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
          margin: 0; padding: 0;
          font-family: 'Outfit', sans-serif;
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
          color: #ffffff;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh;
        }
        .container {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 50px 40px;
          text-align: center;
          max-width: 680px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          animation: fadeIn 1s ease-out;
        }
        h1 {
          font-size: 2.5rem; margin-bottom: 10px;
          background: linear-gradient(to right, #38bdf8, #818cf8);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        p { font-size: 1.1rem; color: #94a3b8; margin-bottom: 30px; }
        .section-title {
          font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: #64748b;
          margin: 24px 0 8px 0; text-align: left;
        }
        .endpoint-box { background: rgba(0,0,0,0.3); border-radius: 10px; padding: 20px; text-align: left; }
        .endpoint { margin: 12px 0; display: flex; flex-direction: column; gap: 4px; }
        .badge {
          background: #3b82f6; color: white;
          padding: 3px 10px; border-radius: 20px;
          font-size: 0.75rem; font-weight: bold; align-self: flex-start;
        }
        .badge.green  { background: #10b981; }
        .badge.purple { background: #8b5cf6; }
        .badge.orange { background: #f59e0b; }
        .url { color: #38bdf8; font-family: monospace; font-size: 1rem; word-break: break-all; }
        .desc { font-size: 0.82rem; color: #cbd5e1; margin-top: 1px; }
        .tip { font-size: 0.78rem; color: #fbbf24; margin-top: 2px; }
        hr { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 16px 0; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Netra News Hub API</h1>
        <p>Ultra-fast, multi-language news backend — running on Railway.</p>

        <div class="endpoint-box">

          <div class="section-title">Core</div>
          <div class="endpoint">
            <span class="badge orange">System Health</span>
            <span class="url">/api/v1/system/health</span>
            <span class="desc">Sync status, per-language article counts, per-feed health</span>
          </div>
          <div class="endpoint">
            <span class="badge">Languages</span>
            <span class="url">/api/v1/languages</span>
            <span class="desc">Get all supported languages</span>
          </div>

          <hr/>
          <div class="section-title">Categories — returns name + categoryId + englishName</div>
          <div class="endpoint">
            <span class="badge">Telugu Categories</span>
            <span class="url">/api/v1/categories?language=Telugu</span>
            <span class="desc">Returns: [{ name: "ఆంధ్రప్రదేశ్", categoryId: "andhra-pradesh", englishName: "Andhra Pradesh" }, ...]</span>
          </div>
          <div class="endpoint">
            <span class="badge">English / Hindi / Tamil / Kannada…</span>
            <span class="url">/api/v1/categories?language=English</span>
            <span class="desc">Replace language= with any supported language</span>
          </div>

          <hr/>
          <div class="section-title">Articles — filter by language &amp; stable categoryId</div>
          <div class="endpoint">
            <span class="badge purple">All Telugu Articles</span>
            <span class="url">/api/v1/articles?language=Telugu</span>
            <span class="desc">Get all Telugu news articles (20 per page)</span>
          </div>
          <div class="endpoint">
            <span class="badge purple">Telugu by Category (recommended)</span>
            <span class="url">/api/v1/articles?language=Telugu&amp;categoryId=andhra-pradesh</span>
            <span class="desc">Use categoryId from /categories — works reliably across all scripts</span>
            <span class="tip">✦ categoryId slugs: andhra-pradesh · telangana · india · world · sports · cricket · business · technology · politics · health</span>
          </div>
          <div class="endpoint">
            <span class="badge purple">With Pagination</span>
            <span class="url">/api/v1/articles?language=Telugu&amp;page=2&amp;limit=20</span>
            <span class="desc">Paginate results — default limit is 20</span>
          </div>
          <div class="endpoint">
            <span class="badge purple">Single Article</span>
            <span class="url">/api/v1/articles/{articleId}</span>
            <span class="desc">Full article by ID</span>
          </div>

          <hr/>
          <div class="section-title">Search</div>
          <div class="endpoint">
            <span class="badge">Full-Text Search</span>
            <span class="url">/api/v1/search?q=your+search+term</span>
            <span class="desc">Search across all article titles and content</span>
          </div>

          <hr/>
          <div class="section-title">Current Affairs</div>
          <div class="endpoint">
            <span class="badge green">List All Issues</span>
            <span class="url">/api/v1/current-affairs</span>
            <span class="desc">List of daily issues (issueDate, totalTopics, reading time)</span>
          </div>
          <div class="endpoint">
            <span class="badge green">Day Detail</span>
            <span class="url">/api/v1/current-affairs/2026-07-20</span>
            <span class="desc">Full issue: all sections with articles &amp; images</span>
          </div>

        </div>
      </div>
    </body>
    </html>
  `);
});

export default app;
