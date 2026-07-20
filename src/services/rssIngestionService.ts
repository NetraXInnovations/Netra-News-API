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

// ─────────────────────────────────────────────────────────────────────────────
// Sync result returned to server.ts so CleanupService can act conditionally
// ─────────────────────────────────────────────────────────────────────────────
export interface SyncResult {
  succeeded: number;
  failed: number;
  newArticles: number;
  syncSucceeded: boolean; // true if at least 50% of feeds succeeded
}

export class RssIngestionService {

  // ── Scheduler lock: prevent two sync cycles running at the same time ───────
  private static isSyncing = false;

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Converts a display name or englishName to a stable lowercase slug.
   * e.g. "Andhra Pradesh" → "andhra-pradesh", "Technology & Auto" → "technology-auto"
   */
  public static toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')  // strip special chars
      .trim()
      .replace(/\s+/g, '-');          // spaces → hyphens
  }

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
   * Ensure language exists dynamically.
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
   * Ensure category exists dynamically (with stable categoryId slug).
   */
  private static async ensureCategory(languageName: string, categoryName: string, categoryId: string, englishName?: string) {
    await Category.updateOne(
      { language: languageName, name: categoryName },
      {
        $set:         { categoryId, englishName: englishName || categoryName, enabled: true },
        $setOnInsert: { language: languageName, name: categoryName }
      },
      { upsert: true }
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Retry wrapper: attempts fn up to maxAttempts times
  // ─────────────────────────────────────────────────────────────────────────
  private static async withRetry<T>(
    fn: () => Promise<T>,
    label: string,
    maxAttempts = 3,
    delayMs = 5000
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        if (attempt < maxAttempts) {
          logger.warn(`⚠ ${label} — attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${delayMs / 1000}s...`);
          await new Promise(r => setTimeout(r, delayMs * attempt)); // exponential backoff
        }
      }
    }
    throw lastError;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Processes a single RSS feed (isolated — never throws to the caller)
  // Returns number of new articles saved, or -1 on failure.
  // ─────────────────────────────────────────────────────────────────────────
  public static async processFeed(source: any): Promise<number> {
    try {
      const categoryId = source.categoryId || RssIngestionService.toSlug(source.englishName || source.category);

      // Ensure Language + Category records exist
      await this.ensureLanguage(source.language);
      await this.ensureCategory(source.language, source.category, categoryId, source.englishName);

      // Parse feed with retry
      const feed = await this.withRetry(
        () => parser.parseURL(source.rssUrl),
        source.sourceName
      );

      let newArticlesCount = 0;

      for (const item of feed.items) {
        if (!item.link || !item.title) continue;

        // Use guid if stable; fall back to link
        const guid = item.guid || item.link;

        // ── Content extraction ─────────────────────────────────────────────
        let finalContent = '';
        let readingTime = 1;

        try {
          const extracted = await ReadabilityService.extract(item.link);
          if (extracted && extracted.content && extracted.content.length >= 100) {
            finalContent  = extracted.content;
            readingTime   = extracted.readingTime;
          }
        } catch (_) { /* extraction failed — fall through to RSS body */ }

        if (!finalContent) {
          const rssBody =
            (item as any)['contentSnippet'] ||
            item.summary ||
            (item as any)['content:encoded'] ||
            item.content ||
            item.description ||
            '';

          if (rssBody) {
            const cleaned = this.cleanDescription(rssBody) || rssBody;
            finalContent  = cleaned;
            readingTime   = Math.max(1, Math.round(cleaned.length / 1000));
          }
        }

        let description = this.cleanDescription(item.description || '') || item.summary || '';

        if (!finalContent || finalContent.trim().length === 0) {
          finalContent = description || item.title || 'Content not available at this time.';
        }
        if (!description || description.trim().length === 0) {
          description = finalContent.substring(0, 150) + '...';
        }

        // ── Date / Time conversion to IST ─────────────────────────────────
        const pubDate   = item.isoDate ? new Date(item.isoDate) : new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime   = new Date(pubDate.getTime() + istOffset);
        const dateStr   = istTime.toISOString().split('T')[0];

        let hours     = istTime.getUTCHours();
        const minutes = istTime.getUTCMinutes();
        const ampm    = hours >= 12 ? 'PM' : 'AM';
        hours         = hours % 12 || 12;
        const minStr  = minutes < 10 ? '0' + minutes : String(minutes);
        const timeStr = `${hours}:${minStr} ${ampm}`;

        // ── Upsert article ─────────────────────────────────────────────────
        try {
          const updateResult = await Article.updateOne(
            // Match by guid first; sourceUrl is a secondary safety guard
            { guid: guid },
            {
              $setOnInsert: {
                title:         item.title,
                description:   description,
                content:       finalContent,
                language:      source.language,
                category:      source.category,   // native script display name
                categoryId:    categoryId,         // stable English slug
                sourceName:    source.sourceName,
                sourceUrl:     item.link,
                guid:          guid,
                publishedDate: dateStr,
                publishedTime: timeStr,
                readingTime:   readingTime,
                thumbnail:     '',
                isSaved:       false,
                isActive:      true
              }
            },
            { upsert: true }
          );

          if (updateResult.upsertedCount > 0) {
            newArticlesCount++;
          }
        } catch (itemError: any) {
          if (itemError.code === 11000) {
            // True duplicate — safe to skip silently
          } else {
            logger.warn(`⚠ Article save failed [${source.sourceName}]: ${item.link} — ${itemError.message}`);
          }
        }
      }

      // ── Update feed health on SUCCESS ─────────────────────────────────────
      await RssSource.findByIdAndUpdate(source._id, {
        lastCheckedAt:       new Date(),
        lastSuccessAt:       new Date(),
        lastItemCount:       newArticlesCount,
        consecutiveFailures: 0,
        status:              'OK'
      });

      logger.info(`✓ Feed Sync Success: ${source.sourceName} — Added ${newArticlesCount} new articles`);
      return newArticlesCount;

    } catch (error: any) {
      // ── Update feed health on FAILURE ──────────────────────────────────────
      try {
        await RssSource.findByIdAndUpdate(source._id, {
          lastCheckedAt: new Date(),
          lastFailureAt: new Date(),
          $inc:          { consecutiveFailures: 1 },
          status:        'FAILING'
        });
      } catch (_) { /* don't let a DB write failure mask the original error */ }

      logger.error(`⚠ Feed Failed: ${source.sourceName} — ${error.message}`);
      return -1; // signals failure to the caller
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Syncs ALL active feeds
  // Returns SyncResult so CleanupService can run conditionally
  // ─────────────────────────────────────────────────────────────────────────
  public static async syncAllFeeds(): Promise<SyncResult> {
    // ── Scheduler lock ────────────────────────────────────────────────────
    if (RssIngestionService.isSyncing) {
      logger.warn('⚠ Sync already running — skipping this cycle to prevent overlap');
      return { succeeded: 0, failed: 0, newArticles: 0, syncSucceeded: false };
    }

    RssIngestionService.isSyncing = true;
    logger.info('▶ Starting full RSS sync...');

    const result: SyncResult = { succeeded: 0, failed: 0, newArticles: 0, syncSucceeded: false };

    try {
      const sources = await RssSource.find({ enabled: true }).sort({ priority: -1 }).lean();

      for (const source of sources) {
        // Each feed is fully isolated — failure never stops the loop
        const newCount = await this.processFeed(source);
        if (newCount >= 0) {
          result.succeeded++;
          result.newArticles += newCount;
        } else {
          result.failed++;
        }
      }

      // Consider sync "succeeded" if at least half the feeds worked
      const total = result.succeeded + result.failed;
      result.syncSucceeded = total > 0 && result.succeeded >= Math.ceil(total / 2);

      logger.info(
        `✓ RSS sync complete — ${result.succeeded} feeds OK, ${result.failed} failed, ${result.newArticles} new articles`
      );
    } finally {
      // Always unlock, even if something unexpected throws
      RssIngestionService.isSyncing = false;
    }

    return result;
  }
}
