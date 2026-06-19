import axios from 'axios';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { logger } from '../config/logger';

export interface ExtractedArticle {
  title: string;
  content: string;
  readingTime: number;
}

export class ReadabilityService {
  /**
   * Downloads HTML content, cleans it, runs Mozilla Readability, and returns clean text content.
   */
  static async extract(sourceUrl: string): Promise<ExtractedArticle | null> {
    try {
      logger.info({ url: sourceUrl }, 'Starting article content extraction');

      const response = await axios.get(sourceUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      const html = response.data;
      if (!html || typeof html !== 'string') {
        logger.error({ url: sourceUrl }, 'Downloaded HTML content is empty or invalid');
        return null;
      }

      // 1. Initial cleaning using Cheerio
      const $ = cheerio.load(html);
      
      // Remove scripts, styles, forms, elements that aren't content
      $('script, style, iframe, noscript, nav, header, footer, aside, form, svg, video, audio, button, input, textarea, select, dialog').remove();
      
      // Unwrap anchor tags: replace them with their text contents so actual link references are gone
      $('a').each((_, el) => {
        const $el = $(el);
        $el.replaceWith($el.text());
      });
      
      // Remove ads, social share icons, sidebars, newsletters, banners, comments, widgets
      $(
        '[class*="ad-"], [id*="ad-"], .ads, #ads, .ad, .advertisement, ' +
        '.social-share, .social-widgets, .comments, #comments, .comments-area, ' +
        '.related-posts, .related-articles, .newsletter-box, .newsletter-signup, ' +
        '.cookie-banner, .cookie-consent, .footer-links, .nav-menu, .sidebar, #sidebar'
      ).remove();

      const cleanedHtml = $.html();

      // 2. Parse using JSDOM and Mozilla Readability
      const dom = new JSDOM(cleanedHtml, { url: sourceUrl });
      const reader = new Readability(dom.window.document);
      const parsedArticle = reader.parse();

      if (!parsedArticle) {
        logger.warn({ url: sourceUrl }, 'Mozilla Readability failed to parse the document, falling back to body text');
        
        // Fallback: extract title and paragraph texts from cheerio
        const title = $('title').text() || $('h1').first().text();
        const paragraphs: string[] = [];
        $('p').each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 30) {
            paragraphs.push(text);
          }
        });
        const content = paragraphs.join('\n\n');
        
        if (!content) return null;

        const cleanTitle = this.cleanText(title);
        const cleanContent = this.cleanText(content);
        const readingTime = this.calculateReadingTime(cleanContent);

        return {
          title: cleanTitle,
          content: cleanContent,
          readingTime
        };
      }

      const cleanTitle = this.cleanText(parsedArticle.title);
      const cleanContent = this.cleanText(parsedArticle.textContent || parsedArticle.excerpt || '');
      const readingTime = this.calculateReadingTime(cleanContent);

      return {
        title: cleanTitle,
        content: cleanContent,
        readingTime
      };

    } catch (error: any) {
      logger.error({ url: sourceUrl, error: error.message }, 'Failed to extract article content');
      return null;
    }
  }

  /**
   * Helper to clean junk content from text.
   */
  private static cleanText(text: string): string {
    if (!text) return '';

    return text
      // Remove common ad/tracking/cookie boilerplate lines
      .split('\n')
      .map(line => line.trim())
      .filter(line => {
        if (line.length === 0) return false;
        
        // Remove tracking/ad phrases
        const lowerLine = line.toLowerCase();
        if (
          lowerLine.includes('subscribe to our newsletter') ||
          lowerLine.includes('read more:') ||
          lowerLine.includes('also read:') ||
          lowerLine.includes('copyright ©') ||
          lowerLine.includes('all rights reserved') ||
          lowerLine.includes('our website uses cookies') ||
          lowerLine.includes('by continuing to browse') ||
          lowerLine.includes('share this story') ||
          lowerLine.includes('follow us on') ||
          lowerLine.includes('click here for more') ||
          lowerLine.includes('advertisement')
        ) {
          return false;
        }
        return true;
      })
      .map(line => {
        // Strip out direct web links/URLs from text
        return line
          .replace(/https?:\/\/[^\s]+/gi, '')
          .replace(/www\.[^\s]+/gi, '')
          .trim();
      })
      .filter(line => line.length > 0)
      .join('\n')
      // Clean up multiple spaces, duplicate newlines
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Calculates reading time in minutes assuming 200 words per minute.
   */
  private static calculateReadingTime(text: string): number {
    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    return Math.max(1, Math.round(wordCount / 200));
  }
}
