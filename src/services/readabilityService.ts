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

/**
 * Priority-ordered CSS selectors to find article body content.
 * Tries semantic tags first, then common news site class patterns.
 */
const ARTICLE_BODY_SELECTORS = [
  'article',
  '[itemprop="articleBody"]',
  '[class*="article-body"]',
  '[class*="article-content"]',
  '[class*="article-text"]',
  '[id*="article-body"]',
  '[id*="article-content"]',
  '[class*="story-body"]',
  '[class*="story-content"]',
  '[class*="post-body"]',
  '[class*="post-content"]',
  '[class*="entry-content"]',
  '[class*="content-body"]',
  '[class*="news-body"]',
  '[class*="news-content"]',
  '[class*="td-post-content"]',
  '[class*="article__body"]',
  '[class*="article__content"]',
  'main',
  '[role="main"]',
  '.content',
  '#content'
];

export class ReadabilityService {
  /**
   * Downloads HTML content, cleans it, runs Mozilla Readability, and returns clean text content.
   */
  static async extract(sourceUrl: string): Promise<ExtractedArticle | null> {
    try {
      logger.info({ url: sourceUrl }, 'Starting article content extraction');

      const response = await axios.get(sourceUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
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
        logger.warn({ url: sourceUrl }, 'Mozilla Readability failed — trying multi-selector fallback');

        const title = $('title').text() || $('h1').first().text() || '';
        let extractedText = '';

        // Try each selector in priority order; use first one that yields real content
        for (const selector of ARTICLE_BODY_SELECTORS) {
          const el = $(selector).first();
          if (el.length > 0) {
            const text = el.text().trim();
            if (text.length > 100) {
              extractedText = text;
              logger.info({ url: sourceUrl, selector }, 'Fallback selector matched');
              break;
            }
          }
        }

        // Last resort: collect all <p> tags from anywhere in the page
        if (!extractedText) {
          const paragraphs: string[] = [];
          $('p').each((_, el) => {
            const text = $(el).text().trim();
            if (text.length > 15) {
              paragraphs.push(text);
            }
          });
          extractedText = paragraphs.join('\n\n');
        }

        const cleanTitle = this.cleanText(title);
        const cleanContent = this.cleanText(extractedText);
        const readingTime = this.calculateReadingTime(cleanContent);

        // Return even if content is short — never return null just because it's brief
        return {
          title: cleanTitle,
          content: cleanContent || '',
          readingTime: Math.max(1, readingTime)
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
   * Special extraction logic for AffairsCloud Current Affairs pages.
   * Splits a single page with multiple news topics into separate clean articles.
   */
  static async extractAffairsCloud(sourceUrl: string): Promise<Array<{ title: string; content: string; categoryName: string; sourceUrl: string }> | null> {
    try {
      logger.info({ url: sourceUrl }, 'Starting AffairsCloud split article content extraction');
      const response = await axios.get(sourceUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      const html = response.data;
      if (!html || typeof html !== 'string') return null;

      const $ = cheerio.load(html);
      const postContent = $('.td-post-content');
      if (postContent.length === 0) return null;

      const articles: Array<{ title: string; content: string; categoryName: string; sourceUrl: string }> = [];
      let currentCategory = 'NATIONAL AFFAIRS';
      let currentArticle: any = null;

      const slugify = (text: string) => {
        return text
          .toString()
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w\-]+/g, '')
          .replace(/\-\-+/g, '-')
          .replace(/^-+/, '')
          .replace(/-+$/, '');
      };

      postContent.children().each((_, el) => {
        const $el = $(el);
        const tagName = el.tagName.toLowerCase();
        const text = $el.text().trim();
        if (!text) return;

        // Detect Category Header (Red text)
        const redSpan = $el.find('span[style*="color: #ff0000"], span[style*="color: rgb(255, 0, 0)"]');
        if (redSpan.length > 0 && redSpan.text().trim().match(/^[A-Z\s&]+$/)) {
          currentCategory = redSpan.text().trim();
          return;
        }

        // Detect Headline (Blue text or H2/H3 or Q1.)
        const blueSpan = $el.find('span[style*="color: #0000ff"], span[style*="color: rgb(0, 0, 255)"]');
        const isQuestion = text.match(/^Q\d+\./i) || text.startsWith('Current Affairs Question');
        const isHeadline = blueSpan.length > 0 || tagName === 'h2' || tagName === 'h3' || isQuestion;

        if (isHeadline) {
          let headlineText = blueSpan.length > 0 ? blueSpan.text().trim() : text;
          headlineText = headlineText.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();

          // Validation / Filter out non-headline boilerplate
          if (headlineText.length > 15 && 
              !headlineText.toLowerCase().includes('click here') && 
              !headlineText.toLowerCase().includes('current affairs') &&
              !headlineText.toLowerCase().includes('affairscloud')
          ) {
            if (currentArticle && currentArticle.contentParts.length > 0) {
              const fullContent = currentArticle.contentParts.join('\n\n');
              articles.push({
                title: currentArticle.title,
                content: fullContent,
                categoryName: currentArticle.categoryName,
                sourceUrl: currentArticle.sourceUrl
              });
            }

            let initialContent = '';
            if (blueSpan.length > 0) {
              const clonedEl = $el.clone();
              clonedEl.find('span[style*="color: #0000ff"], span[style*="color: rgb(0, 0, 255)"]').remove();
              initialContent = clonedEl.text().trim();
            }

            currentArticle = {
              title: headlineText,
              categoryName: currentCategory,
              contentParts: initialContent ? [initialContent] : [],
              sourceUrl: `${sourceUrl}#${slugify(headlineText)}`
            };
            return;
          }
        }

        // Append content to current article
        if (currentArticle) {
          const lowerText = text.toLowerCase();
          // Filter boilerplates
          if (
            lowerText.includes('click here for') ||
            lowerText.includes('we are hiring') ||
            lowerText.includes('subject matter expert') ||
            lowerText.includes('sharing and legal compliance') ||
            lowerText.includes('careerscloud app')
          ) {
            return;
          }
          currentArticle.contentParts.push(text);
        }
      });

      if (currentArticle && currentArticle.contentParts.length > 0) {
        const fullContent = currentArticle.contentParts.join('\n\n');
        articles.push({
          title: currentArticle.title,
          content: fullContent,
          categoryName: currentArticle.categoryName,
          sourceUrl: currentArticle.sourceUrl
        });
      }

      return articles;
    } catch (error: any) {
      logger.error({ url: sourceUrl, error: error.message }, 'Failed to extract AffairsCloud split content');
      return null;
    }
  }

  /**
   * Calculates reading time in minutes assuming 200 words per minute.
   */
  private static calculateReadingTime(text: string): number {
    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    return Math.max(1, Math.round(wordCount / 200));
  }
}
