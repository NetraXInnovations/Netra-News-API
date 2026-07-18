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

const ARTICLE_BODY_SELECTORS = [
  'article', '[itemprop="articleBody"]', '[class*="article-body"]', 
  '[class*="article-content"]', '[class*="article-text"]', '[id*="article-body"]', 
  '[id*="article-content"]', '[class*="story-body"]', '[class*="story-content"]', 
  '[class*="post-body"]', '[class*="post-content"]', '[class*="entry-content"]', 
  '[class*="content-body"]', '[class*="news-body"]', '[class*="news-content"]', 
  '[class*="td-post-content"]', '[class*="article__body"]', '[class*="article__content"]', 
  'main', '[role="main"]', '.content', '#content'
];

export class ReadabilityService {
  static async extract(sourceUrl: string): Promise<ExtractedArticle | null> {
    try {
      logger.info({ url: sourceUrl }, 'Starting article content extraction');

      const response = await axios.get(sourceUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,te;q=0.8,hi;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });

      const html = response.data;
      if (!html || typeof html !== 'string') return null;

      // 1. Initial cleaning using Cheerio
      const $ = cheerio.load(html);
      
      $('script, style, iframe, noscript, nav, header, footer, aside, form, svg, video, audio, button, input, textarea, select, dialog').remove();
      $('a').each((_, el) => { const $el = $(el); $el.replaceWith($el.text()); });
      
      // Remove known boilerplate classes
      $('[class*="ad-"], [id*="ad-"], .ads, #ads, .ad, .advertisement, .social-share, .social-widgets, .comments, #comments, .comments-area, .related-posts, .related-articles, .newsletter-box, .newsletter-signup, .cookie-banner, .cookie-consent, .footer-links, .nav-menu, .sidebar, #sidebar').remove();

      // SMARTER BOUNDARY DETECTION: Remove entire sections containing common garbage phrases
      $('*').each((_, el) => {
        const text = $(el).text().toLowerCase().trim();
        if (text === 'related articles' || text === 'you may also like' || text === 'trending' || 
            text === 'latest news' || text === 'more stories' || text === 'recommended' || 
            text === 'advertisement' || text === 'comments' || text === 'read next' || text === 'popular news') {
          // Find the closest container (like a div or section) and remove it entirely
          let container = $(el).closest('div, section, aside, ul');
          if (container.length > 0) {
            container.remove();
          } else {
            $(el).remove();
          }
        }
      });

      const cleanedHtml = $.html();

      // 2. Parse using Mozilla Readability
      const dom = new JSDOM(cleanedHtml, { url: sourceUrl });
      const reader = new Readability(dom.window.document);
      const parsedArticle = reader.parse();

      let finalContent = '';
      let finalTitle = $('meta[property="og:title"]').attr('content') || 
                       $('meta[name="twitter:title"]').attr('content') ||
                       $('h1').first().text() || 
                       $('title').text() || 
                       '';

      if (parsedArticle && parsedArticle.content) {
        // Use parsedArticle.content (HTML) to preserve structural paragraphs and lists
        finalContent = this.convertHtmlToFormattedText(parsedArticle.content);
        if (!finalTitle || finalTitle.length < 10) {
          finalTitle = parsedArticle.title || finalTitle;
        }
      } else {
        // Fallback multi-selector strategy
        logger.warn({ url: sourceUrl }, 'Mozilla Readability failed — trying multi-selector fallback');
        for (const selector of ARTICLE_BODY_SELECTORS) {
          const el = $(selector).first();
          if (el.length > 0 && el.text().trim().length > 100) {
            finalContent = this.convertHtmlToFormattedText(el.html() || '');
            break;
          }
        }
        
        if (!finalContent) {
          const paragraphs: string[] = [];
          $('p').each((_, el) => {
            const text = $(el).text().trim();
            if (text.length > 15) paragraphs.push(text);
          });
          finalContent = paragraphs.join('\n\n');
        }
      }

      finalTitle = this.cleanText(finalTitle);
      finalContent = this.cleanText(finalContent);
      
      if (finalContent.length < 50) return null;

      return {
        title: finalTitle,
        content: finalContent,
        readingTime: this.calculateReadingTime(finalContent)
      };

    } catch (error: any) {
      logger.error({ url: sourceUrl, error: error.message }, 'Failed to extract article content');
      return null;
    }
  }

  /**
   * Converts HTML to natural text, preserving paragraphs and bullet lists with single blank lines.
   */
  private static convertHtmlToFormattedText(html: string): string {
    const $ = cheerio.load(html);
    
    // Replace block elements with themselves + double newlines
    $('p, h1, h2, h3, h4, h5, h6, div, article, section').each((_, el) => {
      $(el).append('\n\n');
    });

    $('br').replaceWith('\n');

    // Format list items with bullet points
    $('li').each((_, el) => {
      $(el).prepend('• ').append('\n');
    });

    // Extract raw text now that spacing is injected
    const text = $.text();
    return text;
  }

  private static cleanText(text: string): string {
    if (!text) return '';

    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => {
        if (line.length === 0) return false;
        
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
          lowerLine.includes('advertisement') ||
          lowerLine === 'related articles' ||
          lowerLine === 'trending' ||
          lowerLine === 'read next'
        ) {
          return false;
        }
        return true;
      })
      .map(line => line.replace(/https?:\/\/[^\s]+/gi, '').replace(/www\.[^\s]+/gi, '').trim())
      .filter(line => line.length > 0)
      .join('\n\n') // Combine valid lines with a single blank line
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n') // Max one blank line between paragraphs
      .trim();
  }

  static async extractAffairsCloud(sourceUrl: string): Promise<Array<{ title: string; content: string; categoryName: string; sourceUrl: string }> | null> {
    try {
      const response = await axios.get(sourceUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }
      });
      const html = response.data;
      if (!html || typeof html !== 'string') return null;

      const $ = cheerio.load(html);
      const postContent = $('.td-post-content');
      if (postContent.length === 0) return null;

      const articles: Array<{ title: string; content: string; categoryName: string; sourceUrl: string }> = [];
      let currentCategory = 'NATIONAL AFFAIRS';
      let currentArticle: any = null;

      const slugify = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');

      postContent.children().each((_, el) => {
        const $el = $(el);
        const tagName = el.tagName.toLowerCase();
        const text = $el.text().trim();
        if (!text) return;

        const redSpan = $el.find('span[style*="color: #ff0000"], span[style*="color: rgb(255, 0, 0)"]');
        if (redSpan.length > 0 && redSpan.text().trim().match(/^[A-Z\s&]+$/)) {
          currentCategory = redSpan.text().trim();
          return;
        }

        const blueSpan = $el.find('span[style*="color: #0000ff"], span[style*="color: rgb(0, 0, 255)"]');
        const isQuestion = text.match(/^Q\d+\./i) || text.startsWith('Current Affairs Question');
        const isHeadline = blueSpan.length > 0 || tagName === 'h2' || tagName === 'h3' || isQuestion;

        if (isHeadline) {
          let headlineText = text;
          headlineText = headlineText.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();

          if (headlineText.length > 15 && !headlineText.toLowerCase().includes('click here') && !headlineText.toLowerCase().includes('current affairs')) {
            if (currentArticle && currentArticle.contentParts.length > 0) {
              articles.push({
                title: currentArticle.title,
                content: currentArticle.contentParts.join('\n\n'),
                categoryName: currentArticle.categoryName,
                sourceUrl: currentArticle.sourceUrl
              });
            }

            currentArticle = {
              title: headlineText,
              categoryName: currentCategory,
              contentParts: [],
              sourceUrl: `${sourceUrl}#${slugify(headlineText)}`
            };
            return;
          }
        }

        if (currentArticle) {
          const lowerText = text.toLowerCase();
          if (lowerText.includes('click here for') || lowerText.includes('we are hiring')) return;
          
          const formattedText = ReadabilityService.convertHtmlToFormattedText($el.html() || '').trim();
          currentArticle.contentParts.push(formattedText);
        }
      });

      if (currentArticle && currentArticle.contentParts.length > 0) {
        articles.push({
          title: currentArticle.title,
          content: currentArticle.contentParts.join('\n\n'),
          categoryName: currentArticle.categoryName,
          sourceUrl: currentArticle.sourceUrl
        });
      }

      return articles;
    } catch (error: any) {
      return null;
    }
  }

  private static calculateReadingTime(text: string): number {
    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    return Math.max(1, Math.round(wordCount / 200));
  }
}
