import Parser from 'rss-parser';
import { RssSource } from '../models/RssSource';
import { Article } from '../models/Article';
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
      const sources = await RssSource.find({ enabled: true }).sort({ priority: -1 }).lean();
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

  static async syncFeed(sourceData: any): Promise<void> {
    const { rssUrl, sourceName, language, category, id } = sourceData;

    try {
      let xmlData: string;
      try {
        const response = await axios.get(rssUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });
        xmlData = response.data;
      } catch (err: any) {
        throw new Error(`Axios fetch failed: ${err.message}`);
      }

      let feed: Parser.Output<{ [key: string]: any }>;
      try {
        feed = await parser.parseString(xmlData);
      } catch (err: any) {
        throw new Error(`XML Parse failed: ${err.message}`);
      }

      if (!feed.items || feed.items.length === 0) {
        throw new Error('No items found in feed');
      }

      const isCurrentAffairs = category.toLowerCase() === 'current-affairs';
      const isAffairsCloud = sourceName.includes('AffairsCloud');

      // Process only newest 10 items per feed to save DB operations
      const itemsToProcess = feed.items.slice(0, 10);
      let articlesImported = 0;

      await this.runWithConcurrency(itemsToProcess, 2, async (item) => {
        const link = item.link?.trim() || item.guid?.trim();
        if (!link) return;

        // Clean link
        const articleLink = link.split('?')[0];

        if (isAffairsCloud) {
          const splitArticles = await ReadabilityService.extractAffairsCloud(articleLink);
          if (splitArticles && splitArticles.length > 0) {
            for (const splitArt of splitArticles) {
              const duplicateUrl = await Article.findOne({ sourceUrl: splitArt.sourceUrl }).lean();
              if (duplicateUrl) continue;
              const duplicateTitle = await Article.findOne({ title: splitArt.title }).lean();
              if (duplicateTitle) continue;

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
              const readingTime = Math.max(1, Math.round(content.split(/\s+/).length / 200));
              const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
              
              const articleId = crypto.randomUUID();
              await Article.create({
                id: articleId,
                title: splitArt.title,
                content: content,
                language: language.toLowerCase(),
                category: finalCategory.toLowerCase(),
                sourceName: sourceName,
                sourceUrl: splitArt.sourceUrl,
                publishedDate: publishedAt.toISOString().split('T')[0],
                publishedTime: publishedAt.toISOString().split('T')[1].substring(0, 8),
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

        const duplicateUrl = await Article.findOne({ sourceUrl: articleLink }).lean();
        if (duplicateUrl) return;

        const duplicateTitle = await Article.findOne({ title: title }).lean();
        if (duplicateTitle) return;

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
          const fallbackCandidates = [
            item['content:encoded'],
            item.content,
            item.description,
            item.summary,
            item.contentSnippet
          ].filter(Boolean)
           .map((s: string) => s.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim())
           .sort((a: string, b: string) => b.length - a.length);

          content = fallbackCandidates.length > 0 ? fallbackCandidates[0] : title;
        }

        if (content.length < 50) return; // Skip incredibly short articles

        const readingTime = Math.max(1, Math.round(content.split(/\s+/).length / 200));
        const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

        const articleId = crypto.randomUUID();
        await Article.create({
          id: articleId,
          title: title,
          content: content,
          language: language.toLowerCase(),
          category: category.toLowerCase(),
          sourceName: sourceName,
          sourceUrl: articleLink,
          publishedDate: publishedAt.toISOString().split('T')[0],
          publishedTime: publishedAt.toISOString().split('T')[1].substring(0, 8),
          readingTime: readingTime,
          isSaved: false,
          isActive: true,
          isCurrentAffairs: isCurrentAffairs
        });

        articlesImported++;
      });

      // Update last checked time
      if (id) {
        await RssSource.updateOne({ _id: id }, { lastCheckedAt: new Date() });
      }

    } catch (error: any) {
      throw new Error(`Sync feed failed: ${error.message}`);
    }
  }
}
