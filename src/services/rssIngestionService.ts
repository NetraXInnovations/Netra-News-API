import Parser from 'rss-parser';
import { db } from '../db/db';
import { ReadabilityService } from './readabilityService';
import { logger } from '../config/logger';
import axios from 'axios';
import crypto from 'crypto';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

export class RssIngestionService {
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
              logger.error({ error: err.message }, '⚠ Item processing failed (continue)');
            }
          }
        }
      });
    await Promise.all(workers);
  }

  static async syncAllFeeds(): Promise<void> {
    logger.info('✓ RSS Sync Started');

    try {
      const snapshot = await db.collection('rss_sources').where('enabled', '==', true).orderBy('priority', 'desc').get();
      const sources = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      logger.info({ count: sources.length }, 'Fetched active RSS sources');

      await this.runWithConcurrency(sources, 2, async (source: any) => {
        try {
          await this.syncFeed(source);
        } catch (err: any) {
          logger.error({ source: source.sourceName, error: err.message }, '⚠ Feed Failed (continue)');
        }
      });

      logger.info('✓ RSS Sync Completed successfully');
    } catch (error: any) {
      logger.error({ error: error.message }, '⚠ Failed to run RSS synchronization job (continue)');
    }
  }

  private static readonly CURRENT_AFFAIRS_FEEDS = new Set<string>([]);

  private static async syncFeed(source: any): Promise<void> {
    const { id: sourceId, language, category, sourceName, rssUrl } = source;
    logger.info({ sourceName, rssUrl }, 'Syncing feed');

    let articlesFound = 0;
    let articlesImported = 0;
    let syncError: string | null = null;

    try {
      let feed: any;
      try {
        const response = await axios.get(rssUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        });
        feed = await parser.parseString(response.data);
      } catch (axiosError: any) {
        logger.warn({ sourceName, rssUrl, error: axiosError.message }, 'Axios fetch failed, falling back to direct parser');
        feed = await parser.parseURL(rssUrl);
      }
      
      const items = feed.items || [];
      articlesFound = items.length;

      await this.runWithConcurrency(items, 5, async (item: any) => {
        const link = item.link || item.guid;
        const articleLink = link || (item.title ? `rss://no-link/${encodeURIComponent(item.title)}` : null);
        if (!articleLink) return;

        const isAffairsCloud = articleLink.includes('affairscloud.com');
        const isCurrentAffairs = isAffairsCloud || RssIngestionService.CURRENT_AFFAIRS_FEEDS.has(rssUrl);

        if (isAffairsCloud) {
          const splitArticles = await ReadabilityService.extractAffairsCloud(articleLink);
          if (splitArticles && splitArticles.length > 0) {
            for (const splitArt of splitArticles) {
              const duplicateUrl = await db.collection('articles').where('sourceUrl', '==', splitArt.sourceUrl).limit(1).get();
              if (!duplicateUrl.empty) continue;
              const duplicateTitle = await db.collection('articles').where('title', '==', splitArt.title).limit(1).get();
              if (!duplicateTitle.empty) continue;

              let finalCategory = category;
              const catLower = splitArt.categoryName.toLowerCase();
              if (catLower.includes('national') || catLower.includes('india')) finalCategory = 'national';
              else if (catLower.includes('international') || catLower.includes('world')) finalCategory = 'international';
              else if (catLower.includes('sports')) finalCategory = 'sports';
              else if (catLower.includes('science') || catLower.includes('technology') || catLower.includes('environment')) finalCategory = 'technology';
              else if (catLower.includes('banking') || catLower.includes('finance') || catLower.includes('business')) finalCategory = 'business';
              else if (catLower.includes('economy')) finalCategory = 'economy';
              else if (catLower.includes('politics')) finalCategory = 'politics';

              const content = splitArt.content.trim() || splitArt.title || 'Content not available';
              const summary = content.split('\n\n').filter(p => p.trim().length > 0)[0] || content;
              const readingTime = Math.max(1, Math.round(content.split(/\s+/).length / 200));
              const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
              
              const articleId = crypto.randomUUID();
              await db.collection('articles').doc(articleId).set({
                title: splitArt.title,
                content: content,
                summary: summary,
                language: language.toLowerCase(),
                category: finalCategory.toLowerCase(),
                sourceName: sourceName,
                sourceUrl: splitArt.sourceUrl,
                publishedDate: publishedAt.toISOString().split('T')[0],
                publishedTime: publishedAt.toISOString().split('T')[1].substring(0, 8),
                createdAt: new Date().toISOString(),
                readingTime: readingTime,
                isSaved: false,
                isActive: true,
                isCurrentAffairs: isCurrentAffairs
              });
              articlesImported++;
            }
          }
          return;
        }

        // Standard feed handling
        const title = item.title?.trim() || 'Untitled';

        // Duplicate Check 1: URL
        const duplicateUrl = await db.collection('articles').where('sourceUrl', '==', articleLink).limit(1).get();
        if (!duplicateUrl.empty) return;

        // Duplicate Check 2: Title
        const duplicateTitle = await db.collection('articles').where('title', '==', title).limit(1).get();
        if (!duplicateTitle.empty) return;

        let extracted: any = null;
        try {
          extracted = await ReadabilityService.extract(link);
        } catch (err) {
          logger.warn({ link }, 'Readability extraction failed, falling back to RSS item content');
        }
        
        let content = '';
        if (extracted && extracted.content && extracted.content.trim().length > 50) {
          content = extracted.content;
        } else {
          // If true article extraction failed, fallback to raw RSS content summary
          const fallbackCandidates = [
            item['content:encoded'],
            item.content,
            item.description,
            item.summary,
            item.contentSnippet
          ].filter(Boolean)
           .map((s: string) => s.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim())
           .sort((a: string, b: string) => b.length - a.length);

          content = fallbackCandidates[0] || '';
        }

        content = content.trim();

        // Final Validation
        if (!content || content.length < 50) {
          logger.warn({ link: articleLink, title }, 'Skipping — no real article text found or content too short');
          return;
        }

        const finalTitle = extracted?.title?.trim() || title;
        const readingTime = extracted?.readingTime || Math.max(1, Math.round(content.split(/\s+/).length / 200));
        const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
        const summary = content.split('\n\n').filter((p: string) => p.trim().length > 0)[0] || content;

        const articleId = crypto.randomUUID();
        await db.collection('articles').doc(articleId).set({
          title: finalTitle,
          content: content,
          summary: summary,
          language: language.toLowerCase(),
          category: category.toLowerCase(),
          sourceName: sourceName,
          sourceUrl: articleLink,
          publishedDate: publishedAt.toISOString().split('T')[0],
          publishedTime: publishedAt.toISOString().split('T')[1].substring(0, 8),
          createdAt: new Date().toISOString(),
          readingTime: readingTime,
          isSaved: false,
          isActive: true,
          isCurrentAffairs: isCurrentAffairs
        });

        articlesImported++;
      });

      await db.collection('rss_sources').doc(sourceId).update({
        lastCheckedAt: new Date().toISOString()
      });

      logger.info(
        { sourceName, articlesFound, articlesImported },
        '✓ Feed Imported successfully'
      );

    } catch (error: any) {
      syncError = error.message;
      logger.error(
        { sourceName, rssUrl, error: error.message },
        '⚠ Feed Failed (continue)'
      );
    } finally {
      try {
        await db.collection('sync_logs').add({
          sourceName: sourceName,
          status: syncError ? 'failure' : 'success',
          articlesFound: articlesFound,
          articlesImported: articlesImported,
          error: syncError,
          createdAt: new Date().toISOString()
        });
      } catch (logError: any) {
        logger.error({ error: logError.message }, 'Failed to write sync log entry');
      }
    }
  }
}
