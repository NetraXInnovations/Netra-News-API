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

// Comprehensive boilerplate regex patterns to strip from final text
const BOILERPLATE_PATTERNS: RegExp[] = [
  /•?\s*reported\s*by\s*:?\s*.{0,80}/gi,
  /•?\s*published\s*by\s*:?\s*.{0,80}/gi,
  /•?\s*edited\s*by\s*:?\s*.{0,80}/gi,
  /•?\s*written\s*by\s*:?\s*.{0,80}/gi,
  /•?\s*local18\s*/gi,
  /last\s*updated\s*:?\s*.{0,100}/gi,
  /first\s*published\s*:?\s*.{0,100}/gi,
  /published\s*[-–]\s*.{0,100}ist/gi,
  /updated\s*[-–]\s*.{0,100}ist/gi,
  /location\s*:\s*\n?.{0,100}/gi,
  /photo\s*credit\s*:?\s*.{0,80}/gi,
  /image\s*credit\s*:?\s*.{0,80}/gi,
  /image\s*source\s*:?\s*.{0,80}/gi,
  /read\s*all\s*the\s*latest\s*news.{0,200}/gi,
  /also\s*read\s*:.{0,200}/gi,
  /read\s*more\s*:.{0,200}/gi,
  /subscribe\s*to\s*our\s*newsletter.{0,200}/gi,
  /follow\s*us\s*on.{0,100}/gi,
  /share\s*this\s*(story|article|post).{0,100}/gi,
  /copyright\s*©.{0,100}/gi,
  /all\s*rights\s*reserved.{0,100}/gi,
  /\d{1,2}:\d{2}\s*(am|pm)\s*ist/gi,
  /[a-z]+\s+\d{1,2},\s*\d{4}\s+\d{1,2}:\d{2}\s*(am|pm)\s*ist/gi,
  // Remove breadcrumb-like lines: "తెలుగు వార్తలు/ వార్తలు/తెలంగాణ/"
  /[^\s]+\/\s*[^\s]+\/\s*[^\s]+\/.{0,100}/g,
  // Remove single word or short garbage lines (navigation elements)
  /^\+$/gm,
  /^•\s*$/gm,
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

      const $ = cheerio.load(html);

      // === STAGE 1: Remove HTML junk elements BEFORE Readability ===
      // Standard noise elements
      $('script, style, iframe, noscript, nav, header, footer, aside, form, svg, video, audio, button, input, textarea, select, dialog, figure').remove();

      // Ads, social, widgets
      $([
        '[class*="ad-"]', '[id*="ad-"]', '.ads', '#ads', '.ad', '.advertisement',
        '[class*="social"]', '[class*="share"]', '[class*="widget"]',
        '[class*="comment"]', '#comments', '.comments-area',
        '[class*="related"]', '[class*="recommended"]', '[class*="you-may"]',
        '[class*="newsletter"]', '[class*="subscribe"]', '[class*="cookie"]',
        '[class*="sidebar"]', '#sidebar', '[class*="breadcrumb"]',
        '[class*="tag"]', '[class*="label"]', '[class*="category-tag"]',
        '[class*="author"]', '[class*="byline"]', '[class*="reporter"]',
        '[class*="published-by"]', '[class*="reported-by"]',
        '[class*="timestamp"]', '[class*="article-date"]',
        '[class*="location"]', '[class*="source-name"]',
        '[class*="read-more"]', '[class*="also-read"]',
        '[class*="trending"]', '[class*="popular"]',
        '[class*="footer"]', '[class*="nav"]', '[class*="menu"]',
        '[class*="pagination"]', '[class*="pager"]',
        '[class*="promo"]', '[class*="banner"]',
        '.article__meta', '.article-meta', '.post-meta',
        '.article-bottom', '.article__bottom', '.story-tags',
        '.fn-content-author', '.fn-author',
      ].join(', ')).remove();

      // Remove links and replace with text (prevents anchor text noise)
      $('a').each((_, el) => { const $el = $(el); $el.replaceWith($el.text()); });

      // Remove short noise divs/spans that are navigation/labels
      $('span, div').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 0 && text.length < 30) {
          const lower = text.toLowerCase();
          if (lower === 'local18' || lower === 'news18' || lower === '+' ||
              lower === 'more' || lower === 'trending' || lower === 'advertisement' ||
              lower === 'sponsored' || lower === 'read more' || lower === 'also read') {
            $(el).remove();
          }
        }
      });

      const cleanedHtml = $.html();

      // === STAGE 2: Mozilla Readability ===
      const dom = new JSDOM(cleanedHtml, { url: sourceUrl });
      const reader = new Readability(dom.window.document);
      const parsedArticle = reader.parse();

      let finalContent = '';
      let finalTitle =
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('h1').first().text() ||
        $('title').text() || '';

      if (parsedArticle && parsedArticle.content) {
        finalContent = this.convertHtmlToFormattedText(parsedArticle.content);
        if (!finalTitle || finalTitle.length < 10) {
          finalTitle = parsedArticle.title || finalTitle;
        }
      } else {
        // Fallback: try article body selectors
        logger.warn({ url: sourceUrl }, 'Mozilla Readability failed — trying multi-selector fallback');
        for (const selector of ARTICLE_BODY_SELECTORS) {
          const el = $(selector).first();
          if (el.length > 0 && el.text().trim().length > 100) {
            finalContent = this.convertHtmlToFormattedText(el.html() || '');
            break;
          }
        }
        // Final fallback: collect paragraphs
        if (!finalContent) {
          const paragraphs: string[] = [];
          $('p').each((_, el) => {
            const text = $(el).text().trim();
            if (text.length > 20) paragraphs.push(text);
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

  private static convertHtmlToFormattedText(html: string): string {
    const $ = cheerio.load(html);
    $('p, h1, h2, h3, h4, h5, h6, div, article, section').each((_, el) => {
      $(el).append('\n\n');
    });
    $('br').replaceWith('\n');
    $('li').each((_, el) => {
      $(el).prepend('• ').append('\n');
    });
    return $.text();
  }

  private static cleanText(text: string): string {
    if (!text) return '';

    // === STAGE 3: Regex-based boilerplate removal ===
    let cleaned = text;
    for (const pattern of BOILERPLATE_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }

    // === STAGE 4: Line-by-line filter ===
    const lines = cleaned.split('\n').map(l => l.trim()).filter(line => {
      if (!line) return false;
      const l = line.toLowerCase();

      // Author/byline lines
      if (l.startsWith('reported by') || l.startsWith('• reported by')) return false;
      if (l.startsWith('published by') || l.startsWith('• published by')) return false;
      if (l.startsWith('edited by') || l.startsWith('written by')) return false;

      // Date/time lines
      if (l.startsWith('last updated') || l.startsWith('first published')) return false;
      if (l.startsWith('updated on') || l.startsWith('published on')) return false;
      if (/^\w+ \d{1,2}, \d{4}/.test(line) && (l.includes('ist') || l.includes('am') || l.includes('pm'))) return false;

      // Location and source
      if (l.startsWith('location :') || l.startsWith('location:')) return false;
      if (l.startsWith('photo credit') || l.startsWith('image credit') || l.startsWith('image source')) return false;

      // Navigation/breadcrumbs
      if (l.includes('వార్తలు/') || l.includes('తెలుగు వార్తలు')) return false;
      if (l.includes('समाचार/') || l.includes('ख़बरें/')) return false;
      if (l.includes('সংবাদ/') || l.includes('খবর/')) return false;
      if (l.includes('செய்திகள்/') || l.includes('தமிழ் செய்திகள்')) return false;
      if (l.includes('വാർത്ത/') || l.includes('മലയാളം')) return false;
      if (l.includes('news/') && l.includes('/')) return false;

      // Site boilerplate
      if (l.includes('subscribe to our newsletter')) return false;
      if (l.includes('read more:') || l.includes('also read:')) return false;
      if (l.includes('copyright ©') || l.includes('all rights reserved')) return false;
      if (l.includes('follow us on') || l.includes('share this story')) return false;
      if (l.includes('advertisement') || l.includes('click here for more')) return false;
      if (l.includes('read all the latest news')) return false;

      if (l === 'local18' || l === 'news18' || l === 'news18-telugu' || l === 'ndtv' || l === 'abp live') return false;
      if (l.startsWith('news18-') || l.startsWith('abp ') || l.startsWith('zee news')) return false;

      // Also-read / Related links in all languages
      if (l.startsWith('ఇవి కూడా చదవండి') || l.startsWith('కూడా చదవండి') || l.startsWith('మరిన్ని చదవండి')) return false;
      if (l.startsWith('यह भी पढ़ें') || l.startsWith('यह भी पढ़िए')) return false;
      if (l.startsWith('இதையும் படிக்கலாம்') || l.startsWith('மேலும் படிக்க')) return false;
      if (l.startsWith('ഇതും വായിക്കാം') || l.startsWith('കൂടുതൽ വായിക്കുക')) return false;
      if (l.startsWith('ಇದನ್ನೂ ಓದಿ') || l.startsWith('ಮತ್ತಷ್ಟು ಓದಿ')) return false;
      if (l.startsWith('আরও পড়ুন') || l.startsWith('এটিও পড়ুন')) return false;

      // Twitter/X embed noise
      if (l.includes('pic.twitter.com/') || l.includes('twitter.com/') || l.includes('t.co/')) return false;
      if (l.startsWith('— ') && l.includes('@') && l.includes(')')) return false;
      if (/^— .+\(@.+\) .+\d{4}$/.test(line)) return false;

      // Single symbol noise
      if (line === '+' || line === '•' || line === '|' || line === '-') return false;


      return true;
    });

    return lines.join('\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
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
          let headlineText = text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
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
