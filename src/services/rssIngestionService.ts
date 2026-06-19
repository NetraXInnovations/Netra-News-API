import Parser from 'rss-parser';
import { db } from '../db/db';
import { ReadabilityService } from './readabilityService';
import { logger } from '../config/logger';
import axios from 'axios';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

export class RssIngestionService {
  /**
   * Helper to process items with a concurrent sliding window queue.
   * Keeps exactly `concurrency` workers running until the queue is empty.
   */
  private static async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<void>
  ): Promise<void> {
    const queue = [...items];
    const workers = Array(Math.min(concurrency, queue.length))
      .fill(null)
      .map(async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item) {
            try {
              await fn(item);
            } catch (err: any) {
              logger.error({ error: err.message }, 'Error in concurrent worker task');
            }
          }
        }
      });
    await Promise.all(workers);
  }

  private static cleanAndBuildParagraphs(rawText: string): string {
    if (!rawText) return 'No content available';

    // STEP 1: Clean article text
    const skipKeywords = [
      "ALSO READ", "READ MORE", "ADVERTISEMENT", "Download App", "Disclaimer",
      "Promotional Text", "TargetReturnStopLoss", "Author Promotion", "Related Articles",
      "Sponsored Content", "Download TOI App", "Build Your Legacy",
      "Stock market recommendations"
    ];

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const validLines = lines.filter(line => {
      if (skipKeywords.some(kw => line.toLowerCase().includes(kw.toLowerCase()))) return false;
      return true;
    });

    // STEP 2: Sentence Detection
    const text = validLines.join(' ');
    // Split by . ! ? followed by space and uppercase letter, or end of string.
    const sentenceRegex = /[^.!?]+[.!?]+/g;
    let sentences = text.match(sentenceRegex)?.map(s => s.trim()) || [text];
    if (sentences.length === 1 && sentences[0] === text && !text.match(/[.!?]$/)) {
        // Fallback if no punctuation matches
        sentences = [text];
    } else {
        sentences = sentences.filter(s => s.length > 0);
    }

    // STEP 3: Paragraph Builder
    const paragraphs: string[] = [];
    let currentSentences: string[] = [];
    let currentLen = 0;

    for (const sentence of sentences) {
      if (!sentence) continue;
      
      const potentialLen = currentLen + (currentSentences.length > 0 ? 1 : 0) + sentence.length;
      
      if (currentSentences.length >= 4 || potentialLen > 350) {
        if (currentSentences.length > 0) {
          paragraphs.push(currentSentences.join(' '));
        }
        currentSentences = [sentence];
        currentLen = sentence.length;
      } else {
        currentSentences.push(sentence);
        currentLen = potentialLen;
        if (currentLen >= 120 && currentSentences.length >= 2) {
          paragraphs.push(currentSentences.join(' '));
          currentSentences = [];
          currentLen = 0;
        }
      }
    }
    
    if (currentSentences.length > 0) {
      paragraphs.push(currentSentences.join(' '));
    }

    // STEP 4: Content Length (3 to 6 paragraphs)
    return paragraphs.slice(0, 6).join('\n\n');
  }

  /**
   * Synchronizes all active RSS feeds in parallel batches.
   */
  static async syncAllFeeds(): Promise<void> {
    logger.info('Starting RSS synchronization job');

    try {
      // 1. Fetch enabled RSS sources
      const sourcesRes = await db.query(
        'SELECT id, language_id, category_id, source_name, rss_url FROM rss_sources WHERE enabled = true ORDER BY priority DESC'
      );

      const sources = sourcesRes.rows;
      logger.info({ count: sources.length }, 'Fetched active RSS sources');

      // Sync up to 2 feeds concurrently
      await this.runWithConcurrency(sources, 2, async (source) => {
        await this.syncFeed(source);
      });

      logger.info('RSS synchronization job completed successfully');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to run RSS synchronization job');
    }
  }

  private static readonly CURRENT_AFFAIRS_FEEDS = new Set([
    // English
    'https://www.thehindu.com/news/national/feeder/default.rss',
    'https://www.thehindu.com/news/international/feeder/default.rss',
    'https://www.news18.com/commonfeeds/v1/eng/rss/politics.xml',
    'https://timesofindia.indiatimes.com/rssfeeds/1898055.cms',
    'https://frontline.thehindu.com/economy/feeder/default.rss',
    'https://timesofindia.indiatimes.com/rssfeeds/66949542.cms',
    'https://timesofindia.indiatimes.com/rssfeeds/-2128672765.cms',
    'https://timesofindia.indiatimes.com/rssfeeds/913168846.cms',
    'https://www.indiatoday.in/rss/1206550',
    'https://timesofindia.indiatimes.com/rssfeeds/54829575.cms',

    // Telugu
    'https://telugu.news18.com/commonfeeds/v1/tel/rss/national.xml',
    'https://telugu.news18.com/commonfeeds/v1/tel/rss/international.xml',
    'https://telugu.news18.com/commonfeeds/v1/tel/rss/national/politics-national.xml',
    'https://telugu.news18.com/commonfeeds/v1/tel/rss/business.xml',
    'https://telugu.news18.com/commonfeeds/v1/tel/rss/technology.xml',
    'https://telugu.news18.com/commonfeeds/v1/tel/rss/science.xml',
    'https://telugu.news18.com/commonfeeds/v1/tel/rss/life-style/health.xml',
    'https://telugu.news18.com/commonfeeds/v1/tel/rss/sports.xml',
    'https://telugu.news18.com/commonfeeds/v1/tel/rss/cricket.xml',

    // Hindi
    'https://www.bhaskar.com/rss-v1--category-1061.xml',
    'https://www.bhaskar.com/rss-v1--category-1125.xml',
    'https://hindi.news18.com/commonfeeds/v1/hin/rss/states.xml',
    'https://www.bhaskar.com/rss-v1--category-1051.xml',
    'https://www.bhaskar.com/rss-v1--category-5707.xml',
    'https://hindi.gadgets360.com/rss/science/news',
    'https://www.indiatv.in/rssnews/topstory-education.xml',
    'https://hindi.news18.com/commonfeeds/v1/hin/rss/lifestyle/health.xml',
    'https://www.bhaskar.com/rss-v1--category-1053.xml',
    'https://hindi.news18.com/commonfeeds/v1/hin/rss/sports/cricket.xml',

    // Tamil
    'https://www.vikatan.com/api/v1/collections/india-news.rss',
    'https://www.vikatan.com/api/v1/collections/international.rss',
    'https://tamil.news18.com/commonfeeds/v1/tam/rss/education.xml',
    'https://www.vikatan.com/stories.rss?section-id=8968',
    'https://tamil.news18.com/commonfeeds/v1/tam/rss/business.xml',
    'https://www.vikatan.com/stories.rss?section-id=8965',
    'https://www.vikatan.com/stories.rss?section-id=8963',
    'https://tamil.news18.com/commonfeeds/v1/tam/rss/sports.xml',
    'https://tamil.news18.com/commonfeeds/v1/tam/rss/sports/cricket.xml',

    // Bengali
    'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml',
    'https://www.anandabazar.com/rss/state.xml',
    'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml?cat=india',
    'https://www.anandabazar.com/rss/india.xml',
    'https://bengali.oneindia.com/rss/feeds/bengali-news-world-fb.xml',
    'https://www.anandabazar.com/rss/international.xml',
    'https://www.anandabazar.com/rss/politics.xml',
    'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml?cat=politics',
    'https://www.anandabazar.com/rss/business.xml',
    'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml?cat=business',
    'https://bengali.oneindia.com/rss/feeds/bengali-gadgets-fb.xml',
    'https://www.anandabazar.com/rss/science.xml',
    'https://bengali.oneindia.com/rss/feeds/bengali-lifestyle-fb.xml',
    'https://www.anandabazar.com/rss/lifestyle.xml',
    'https://bengali.oneindia.com/rss/feeds/bengali-sports-fb.xml',
    'https://www.anandabazar.com/rss/sports.xml',

    // Gujarati
    'https://gujarati.oneindia.com/rss/feeds/gujarati-news-fb.xml?cat=gujarat',
    'https://tv9gujarati.com/rss/state-news.xml',
    'https://gujarati.oneindia.com/rss/feeds/oneindia-gujarati-fb.xml?cat=india',
    'https://tv9gujarati.com/rss/national-news.xml',
    'https://gujarati.oneindia.com/rss/feeds/gujarati-news-world-fb.xml',
    'https://tv9gujarati.com/rss/world-news.xml',
    'https://tv9gujarati.com/rss/politics-news.xml',
    'https://gujarati.oneindia.com/rss/feeds/oneindia-gujarati-fb.xml?cat=politics',
    'https://tv9gujarati.com/rss/business-news.xml',
    'https://gujarati.oneindia.com/rss/feeds/gujarati-news-fb.xml?cat=business',
    'https://gujarati.oneindia.com/rss/feeds/gujarati-gadgets-fb.xml?cat=tech',
    'https://tv9gujarati.com/rss/technology-news.xml',
    'https://gujarati.oneindia.com/rss/feeds/gujarati-gadgets-fb.xml?cat=science',
    'https://tv9gujarati.com/rss/technology-news.xml?cat=science',
    'https://gujarati.oneindia.com/rss/feeds/gujarati-lifestyle-fb.xml?cat=health',
    'https://tv9gujarati.com/rss/health-news.xml',
    'https://gujarati.oneindia.com/rss/feeds/gujarati-sports-fb.xml',
    'https://tv9gujarati.com/rss/sports-news.xml',

    // Kannada
    'https://kannada.oneindia.com/rss/feeds/kannada-news-fb.xml',
    'https://kannada.oneindia.com/rss/feeds/kannada-bengaluru-fb.xml',
    'https://kannada.oneindia.com/rss/feeds/oneindia-kannada-fb.xml',
    'https://kannada.oneindia.com/rss/feeds/kannada-news-fb.xml?cat=india',
    'https://kannada.oneindia.com/rss/feeds/kannada-news-world-fb.xml',
    'https://kannada.oneindia.com/rss/feeds/oneindia-kannada-fb.xml?cat=world',
    'https://kannada.oneindia.com/rss/feeds/kannada-news-fb.xml?cat=politics',
    'https://kannada.oneindia.com/rss/feeds/oneindia-kannada-fb.xml?cat=business',
    'https://kannada.oneindia.com/rss/feeds/artificial-intelligence-fb.xml',
    'https://kannada.oneindia.com/rss/feeds/kannada-gadgets-fb.xml',
    'https://kannada.oneindia.com/rss/feeds/artificial-intelligence-fb.xml?cat=science',
    'https://kannada.oneindia.com/rss/feeds/kannada-gadgets-fb.xml?cat=science',
    'https://kannada.oneindia.com/rss/feeds/kannada-lifestyle-fb.xml',
    'https://kannada.oneindia.com/rss/feeds/kannada-health-fb.xml',
    'https://kannada.oneindia.com/rss/feeds/kannada-sports-fb.xml',
    'https://kannada.oneindia.com/rss/feeds/kannada-news-fb.xml?cat=sports',

    // Malayalam
    'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml',
    'https://www.onmanorama.com/news/kerala.rss',
    'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml?cat=india',
    'https://www.onmanorama.com/news/india.rss',
    'https://malayalam.oneindia.com/rss/feeds/malayalam-news-world-fb.xml',
    'https://www.onmanorama.com/news/world.rss',
    'https://www.onmanorama.com/news/india.rss?cat=politics',
    'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml?cat=politics',
    'https://www.onmanorama.com/business.rss',
    'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml?cat=business',
    'https://malayalam.oneindia.com/rss/feeds/artificial-intelligence-fb.xml',
    'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml?cat=tech',
    'https://malayalam.oneindia.com/rss/feeds/artificial-intelligence-fb.xml?cat=science',
    'https://www.onmanorama.com/news/world.rss?cat=science',
    'https://malayalam.oneindia.com/rss/feeds/malayalam-lifestyle-fb.xml?cat=health',
    'https://www.onmanorama.com/lifestyle/health.rss',
    'https://malayalam.oneindia.com/rss/feeds/malayalam-sports-fb.xml',
    'https://www.onmanorama.com/sports.rss',

    // Marathi
    'https://marathi.oneindia.com/rss/feeds/marathi-news-fb.xml?cat=maharashtra',
    'https://www.lokmat.com/rss/maharashtra.xml',
    'https://marathi.oneindia.com/rss/feeds/marathi-news-fb.xml?cat=india',
    'https://www.lokmat.com/rss/national.xml',
    'https://marathi.oneindia.com/rss/feeds/marathi-news-world-fb.xml',
    'https://www.lokmat.com/rss/international.xml',
    'https://www.lokmat.com/rss/politics.xml',
    'https://marathi.oneindia.com/rss/feeds/marathi-news-fb.xml?cat=politics',
    'https://www.lokmat.com/rss/business.xml',
    'https://marathi.oneindia.com/rss/feeds/marathi-news-fb.xml?cat=business',
    'https://marathi.oneindia.com/rss/feeds/artificial-intelligence-fb.xml',
    'https://marathi.oneindia.com/rss/feeds/marathi-gadgets-fb.xml',
    'https://marathi.oneindia.com/rss/feeds/artificial-intelligence-fb.xml?cat=science',
    'https://marathi.oneindia.com/rss/feeds/marathi-gadgets-fb.xml?cat=science',
    'https://marathi.oneindia.com/rss/feeds/marathi-lifestyle-fb.xml?cat=health',
    'https://www.lokmat.com/rss/health.xml',
    'https://marathi.oneindia.com/rss/feeds/marathi-sports-fb.xml',
    'https://www.lokmat.com/rss/sports.xml',

    // Odia
    'https://odia.oneindia.com/rss/feeds/odia-news-fb.xml',
    'https://sambad.in/feed',
    'https://odia.oneindia.com/rss/feeds/odia-news-fb.xml?cat=india',
    'https://sambad.in/india-and-beyond/feed',
    'https://odia.oneindia.com/rss/feeds/odia-news-world-fb.xml',
    'https://sambad.in/international/feed',
    'https://sambad.in/politics/feed',
    'https://odia.oneindia.com/rss/feeds/odia-news-fb.xml?cat=politics',
    'https://sambad.in/business/feed',
    'https://odia.oneindia.com/rss/feeds/odia-news-fb.xml?cat=business',
    'https://odia.oneindia.com/rss/feeds/artificial-intelligence-fb.xml',
    'https://sambad.in/technology/feed',
    'https://sambad.in/science/feed',
    'https://odia.oneindia.com/rss/feeds/artificial-intelligence-fb.xml?cat=science',
    'https://sambad.in/lifestyle/health/feed',
    'https://odia.oneindia.com/rss/feeds/odia-lifestyle-fb.xml?cat=health',
    'https://sambad.in/sports/feed',
    'https://odia.oneindia.com/rss/feeds/odia-sports-fb.xml',

    // Punjabi
    'https://punjabi.oneindia.com/rss/feeds/punjabi-news-fb.xml',
    'https://www.punjabitribuneonline.com/feed/',
    'https://www.jagbani.com/rss/news/national.xml',
    'https://punjabi.oneindia.com/rss/feeds/punjabi-news-world-fb.xml',
    'https://www.jagbani.com/rss/news/international.xml',
    'https://www.jagbani.com/rss/news/politics.xml',
    'https://www.jagbani.com/rss/business.xml',
    'https://punjabi.oneindia.com/rss/feeds/artificial-intelligence-fb.xml',
    'https://www.jagbani.com/rss/technology.xml',
    'https://punjabi.oneindia.com/rss/feeds/punjabi-lifestyle-fb.xml',
    'https://www.jagbani.com/rss/health.xml',
    'https://punjabi.oneindia.com/rss/feeds/punjabi-sports-fb.xml',
    'https://www.jagbani.com/rss/sports.xml'
  ]);

  /**
   * Syncs a single RSS source feed.
   */
  private static async syncFeed(source: any): Promise<void> {
    const { id: sourceId, language_id: languageId, category_id: categoryId, source_name: sourceName, rss_url: rssUrl } = source;
    logger.info({ sourceName, rssUrl }, 'Syncing feed');

    let articlesFound = 0;
    let articlesImported = 0;
    let syncError: string | null = null;

    try {
      // 2. Fetch and parse the feed
      let feed: any;
      try {
        const response = await axios.get(rssUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Upgrade-Insecure-Requests': '1'
          }
        });
        feed = await parser.parseString(response.data);
      } catch (axiosError: any) {
        logger.warn({ sourceName, rssUrl, error: axiosError.message }, 'Axios fetch failed, falling back to direct parser');
        feed = await parser.parseURL(rssUrl);
      }
      const items = feed.items || [];
      articlesFound = items.length;

      // Process up to 3 articles concurrently in a sliding window
      await this.runWithConcurrency(items, 3, async (item: any) => {
        const link = item.link || item.guid;
        if (!link) return;

        // 3. Duplicate check
        const duplicateRes = await db.query(
          'SELECT 1 FROM articles WHERE source_url = $1',
          [link]
        );

        if (duplicateRes.rowCount && duplicateRes.rowCount > 0) {
          // Skip duplicate
          return;
        }

        // 4. Extract and clean full article content
        let extracted: any = null;
        try {
          extracted = await ReadabilityService.extract(link);
        } catch (err) {
          logger.warn({ link }, 'Readability extraction failed, falling back to RSS item content');
        }
        
        let content = '';
        if (extracted && extracted.content && extracted.content.trim().length > 100) {
          content = extracted.content;
        } else {
          // Fallback to embedded RSS content fields. These often contain full HTML articles.
          let fallback = item['content:encoded'] || item.content || item.description || item.summary || item.contentSnippet || 'No content available';
          // Strip HTML tags to provide clean text to the paragraph builder
          content = fallback.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ');
        }
        
        content = content.trim() || 'No content available';
        content = this.cleanAndBuildParagraphs(content);
        
        let readingTime = extracted?.readingTime || Math.max(1, Math.round(content.split(/\s+/).length / 200));
        const title = extracted?.title || item.title || 'Untitled';
        const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

        // Check if this feed belongs to current affairs list
        const isCurrentAffairs = RssIngestionService.CURRENT_AFFAIRS_FEEDS.has(rssUrl);

        // 5. Store article
        await db.query(
          `INSERT INTO articles (language_id, category_id, title, content, source_url, published_at, reading_time, is_current_affairs)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            languageId,
            categoryId,
            title,
            content,
            link,
            publishedAt,
            readingTime,
            isCurrentAffairs
          ]
        );

        articlesImported++;
      });

      // Update last checked time
      await db.query(
        'UPDATE rss_sources SET last_checked_at = NOW() WHERE id = $1',
        [sourceId]
      );

      logger.info(
        { sourceName, articlesFound, articlesImported },
        'Synced feed successfully'
      );

    } catch (error: any) {
      syncError = error.message;
      logger.error(
        { sourceName, rssUrl, error: error.message },
        'Failed to sync RSS source feed'
      );
    } finally {
      // 6. Log the sync result in sync_logs
      try {
        await db.query(
          `INSERT INTO sync_logs (rss_source_id, status, articles_found, articles_imported, error_message)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            sourceId,
            syncError ? 'failure' : 'success',
            articlesFound,
            articlesImported,
            syncError
          ]
        );
      } catch (logError: any) {
        logger.error({ error: logError.message }, 'Failed to write sync log entry');
      }
    }
  }
}
