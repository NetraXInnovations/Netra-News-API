import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

import { RssSource } from '../models/RssSource';
import { Article } from '../models/Article';
import { Language } from '../models/Language';
import { Category } from '../models/Category';
import { ReadabilityService } from './readabilityService';
import { logger } from '../config/logger';

const parser = new Parser({
  customFields: {
    item: ['media:content', 'description', 'content:encoded']
  }
});

export class RssIngestionService {

  /**
   * Cleans HTML from the RSS description/content:encoded tag, preserving paragraphs.
   */
  private static cleanDescription(htmlContent: string): string | null {
    if (!htmlContent) return null;
    const $ = cheerio.load(htmlContent);
    $('script, style, iframe, noscript, nav, header, footer, aside').remove();
    $('br').replaceWith('\n');
    $('p').append('\n\n');

    let plainText = $.text();
    plainText = plainText.replace(/\\n/g, '\n').replace(/\\t/g, '').replace(/\\r/g, '').replace(/\r/g, '');

    const paragraphs = plainText
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    return paragraphs.length > 0 ? paragraphs.join('\n\n') : null;
  }

  /**
   * Ensure language exists dynamically
   */
  private static async ensureLanguage(languageName: string) {
    const langCode = languageName.substring(0, 2).toLowerCase();
    await Language.updateOne(
      { name: languageName },
      { $setOnInsert: { name: languageName, code: langCode, enabled: true } },
      { upsert: true }
    );
  }

  /**
   * Ensure category exists dynamically
   */
  private static async ensureCategory(languageName: string, categoryName: string) {
    await Category.updateOne(
      { language: languageName, name: categoryName },
      { $setOnInsert: { language: languageName, name: categoryName, enabled: true } },
      { upsert: true }
    );
  }

  /**
   * Processes a single RSS feed
   */
  public static async processFeed(source: any): Promise<void> {
    try {
      // Dynamic entities creation
      await this.ensureLanguage(source.language);
      await this.ensureCategory(source.language, source.category);

      const feed = await parser.parseURL(source.rssUrl);

      let newArticlesCount = 0;

      for (const item of feed.items) {
        if (!item.link || !item.title) continue;

        // 1. Duplicate check
        const exists = await Article.exists({ sourceUrl: item.link });
        if (exists) continue;

        // 2. Try to extract full content using the full ReadabilityService (with all fallbacks)
        let finalContent: string = '';
        let readingTime: number = 1;

        const extracted = await ReadabilityService.extract(item.link);

        if (extracted && extracted.content && extracted.content.length >= 100) {
          // Full article extraction succeeded
          finalContent = extracted.content;
          readingTime = extracted.readingTime;
        } else {
          // Fallback: use content:encoded or description from RSS feed itself
          const rssBody =
            (item as any)['content:encoded'] ||
            item.content ||
            item.description ||
            '';

          if (rssBody) {
            const cleaned = this.cleanDescription(rssBody);
            if (cleaned && cleaned.length >= 50) {
              finalContent = cleaned;
              readingTime = Math.max(1, Math.round(cleaned.length / 1000));
            }
          }

          // If still empty, skip this article
          if (!finalContent || finalContent.length < 50) {
            logger.warn({ url: item.link }, '⚠ Skipping article: no content extracted from full page or RSS feed');
            continue;
          }
        }

        // 3. Extract description from RSS feed description tag
        const description = this.cleanDescription(item.description || '');

        // 4. Build and save article
        const pubDate = item.isoDate ? new Date(item.isoDate) : new Date();
        const dateStr = pubDate.toISOString().split('T')[0];
        const timeStr = pubDate.toISOString().split('T')[1].substring(0, 5);

        const newArticle = new Article({
          title: item.title,
          description: description,
          content: finalContent,
          language: source.language,
          category: source.category,
          sourceName: source.sourceName,
          sourceUrl: item.link,
          publishedDate: dateStr,
          publishedTime: timeStr,
          readingTime: readingTime,
          thumbnail: '',
          isSaved: false,
          isActive: true
        });

        await newArticle.save();
        newArticlesCount++;
      }

      // Update last checked
      await RssSource.findByIdAndUpdate(source._id, { lastCheckedAt: new Date() });
      logger.info(`✓ Feed Sync Success: ${source.sourceName} - Added ${newArticlesCount} articles.`);

    } catch (error: any) {
      logger.error(`⚠ Feed Failed: ${source.sourceName} - ${error.message}`);
    }
  }

  /**
   * Syncs all active feeds
   */
  public static async syncAllFeeds(): Promise<void> {
    logger.info('Starting full RSS sync...');
    const sources = await RssSource.find({ enabled: true }).sort({ priority: -1 }).lean();

    for (const source of sources) {
      await this.processFeed(source);
    }

    logger.info('✓ Full RSS sync completed successfully');
  }
}
