import Parser from 'rss-parser';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

import { RssSource } from '../models/RssSource';
import { Article } from '../models/Article';
import { Language } from '../models/Language';
import { Category } from '../models/Category';
import { logger } from '../config/logger';

const parser = new Parser({
  customFields: {
    item: ['media:content', 'description']
  }
});

export class RssIngestionService {
  /**
   * Cleans text to produce proper HTML paragraphs, removing raw newlines.
   */
  private static cleanContent(htmlContent: string): string {
    const $ = cheerio.load(htmlContent);
    let text = $('body').text();
    
    // Remove unwanted chars and normalize spacing
    text = text.replace(/\\n/g, '\n').replace(/\\t/g, '').replace(/\r/g, '');
    
    // Split into paragraphs by newlines
    const paragraphs = text
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p>${p}</p>`);
      
    return paragraphs.join('\n\n');
  }

  /**
   * Creates a simple summary from the cleaned content.
   */
  private static generateSummary(cleanedContent: string): string {
    const $ = cheerio.load(cleanedContent);
    const plainText = $.text();
    return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;
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

        // 2. Fetch HTML
        let html: string;
        try {
          const res = await axios.get(item.link, { timeout: 10000 });
          html = res.data;
        } catch (e) {
          continue; // Skip if website blocks or fails
        }

        // 3. Extract main content with Mozilla Readability
        const dom = new JSDOM(html, { url: item.link });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (!article || !article.textContent) continue;

        // 4. Clean content and generate summary
        const cleanedContent = this.cleanContent(article.textContent);
        const summary = this.generateSummary(cleanedContent);

        // 5. Build and save article
        const pubDate = item.isoDate ? new Date(item.isoDate) : new Date();
        const dateStr = pubDate.toISOString().split('T')[0];
        const timeStr = pubDate.toISOString().split('T')[1].substring(0, 5);

        const newArticle = new Article({
          title: item.title,
          summary: summary,
          content: cleanedContent,
          language: source.language,
          category: source.category,
          sourceName: source.sourceName,
          sourceUrl: item.link,
          publishedDate: dateStr,
          publishedTime: timeStr,
          readingTime: Math.ceil(cleanedContent.length / 1000) || 1,
          thumbnail: article.byline || '', // Fallback, could extract proper images later
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
    
    // Process feeds (batch or parallel could be implemented here, doing sequential for stability right now)
    for (const source of sources) {
      await this.processFeed(source);
    }
    
    logger.info('✓ Full RSS sync completed successfully');
  }
}
