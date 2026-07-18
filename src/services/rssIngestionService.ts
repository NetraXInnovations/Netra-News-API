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

        const guid = item.guid || item.link;

        let finalContent: string = '';
        let readingTime: number = 1;

        const extracted = await ReadabilityService.extract(item.link);

        if (extracted && extracted.content && extracted.content.length >= 100) {
          finalContent = extracted.content;
          readingTime = extracted.readingTime;
        } else {
          // Fallback logic allowing empty DB workaround
          const rssBody =
            (item as any)['contentSnippet'] ||
            item.summary ||
            (item as any)['content:encoded'] ||
            item.content ||
            item.description ||
            '';

          if (rssBody) {
            const cleaned = this.cleanDescription(rssBody) || rssBody;
            finalContent = cleaned;
            readingTime = Math.max(1, Math.round(cleaned.length / 1000));
          }
        }

        let description = this.cleanDescription(item.description || '') || item.summary || '';

        if (!finalContent || finalContent.trim().length === 0) {
          finalContent = description || item.title || 'Content not available at this time.';
        }
        if (!description || description.trim().length === 0) {
          description = finalContent.substring(0, 150) + '...';
        }

        const pubDate = item.isoDate ? new Date(item.isoDate) : new Date();
        
        // Convert to IST (+5:30)
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(pubDate.getTime() + istOffset);
        
        const dateStr = istTime.toISOString().split('T')[0];
        
        // Format 12-hour AM/PM time
        let hours = istTime.getUTCHours();
        const minutes = istTime.getUTCMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const minutesStr = minutes < 10 ? '0' + minutes : minutes;
        
        const timeStr = `${hours}:${minutesStr} ${ampm}`;

        const updateResult = await Article.updateOne(
          { guid: guid },
          {
            $setOnInsert: {
              title: item.title,
              description: description,
              content: finalContent,
              language: source.language,
              category: source.category,
              sourceName: source.sourceName,
              sourceUrl: item.link,
              guid: guid,
              publishedDate: dateStr,
              publishedTime: timeStr,
              readingTime: readingTime,
              thumbnail: '',
              isSaved: false,
              isActive: true
            }
          },
          { upsert: true }
        );

        if (updateResult.upsertedCount > 0) {
          newArticlesCount++;
        }
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
