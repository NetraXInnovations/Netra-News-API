import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { CurrentAffair } from '../models/CurrentAffair';
import { logger } from '../config/logger';

const parser = new Parser();

export class AffairsCloudParser {
  private static RSS_URL = 'https://affairscloud.com/feed/';

  /**
   * Cleans the HTML content of a single topic and preserves paragraphs, lists, and tables.
   */
  private static cleanContent($: cheerio.CheerioAPI, elements: any[]): string {
    let content = '';

    for (const el of elements) {
      const tag = el.tagName.toLowerCase();
      const $el = $(el);

      // Remove unwanted elements
      $el.find('script, style, iframe, img, .adsbygoogle, .sharedaddy, .wp-subscribe-wrap, .yarpp-related, .nc_socialPanel, #comments, .comments-area').remove();

      if (tag === 'p') {
        const text = $el.text().trim();
        if (text && !text.match(/click here|join our|subscribe|download pdf/i)) {
          content += text + '\n\n';
        }
      } else if (tag === 'ul' || tag === 'ol') {
        $el.find('li').each((_, li) => {
          content += '• ' + $(li).text().trim() + '\n';
        });
        content += '\n';
      } else if (tag === 'table') {
        // Keep table structure if possible, or extract text row by row
        $el.find('tr').each((_, tr) => {
          const rowText = $(tr).find('td, th').map((_, cell) => $(cell).text().trim()).get().join(' | ');
          content += rowText + '\n';
        });
        content += '\n';
      } else if (tag === 'h4' || tag === 'h5' || tag === 'h6') {
        content += $el.text().trim() + '\n\n';
      }
    }

    // Clean up extra newlines
    content = content.replace(/\n{3,}/g, '\n\n').trim();
    return content;
  }

  /**
   * Processes the AffairsCloud RSS feed and splits daily digests into topics.
   */
  public static async syncAffairsCloud(): Promise<void> {
    try {
      logger.info('Starting AffairsCloud Current Affairs sync...');
      const feed = await parser.parseURL(this.RSS_URL);
      let newTopicsCount = 0;

      for (const item of feed.items) {
        if (!item.link || !item.title) continue;

        // Ensure it's a current affairs post (usually has "Current Affairs" and a date in the title)
        if (!item.title.toLowerCase().includes('current affairs')) {
          continue;
        }

        logger.info(`Processing Current Affairs Digest: ${item.title}`);
        
        let html: string;
        try {
          const res = await axios.get(item.link, { timeout: 15000 });
          html = res.data;
        } catch (e) {
          logger.error(`Failed to fetch AffairsCloud page: ${item.link}`);
          continue;
        }

        const $ = cheerio.load(html);
        const articleBody = $('.td-post-content, .post-content, .entry-content').first();
        if (!articleBody.length) {
          logger.error(`Could not find article body for: ${item.title}`);
          continue;
        }

        const pubDateStr = item.isoDate ? new Date(item.isoDate) : new Date();
        const dateStr = pubDateStr.toISOString().split('T')[0];
        const timeStr = pubDateStr.toISOString().split('T')[1].substring(0, 5);

        let currentTopicTitle = '';
        let currentTopicElements: any[] = [];

        // Heading detection regex: matches "1.", "2.", "Q.", etc., or strong text that looks like a heading
        const headingRegex = /^(\d+\.|Q\.)\s.+/i;

        const saveCurrentTopic = async () => {
          if (currentTopicTitle && currentTopicElements.length > 0) {
            const content = this.cleanContent($, currentTopicElements);
            if (content.length > 50) { // Ensure it's a substantive topic
              try {
                const exists = await CurrentAffair.exists({ title: currentTopicTitle, sourceUrl: item.link });
                if (!exists) {
                  const currentAffair = new CurrentAffair({
                    title: currentTopicTitle,
                    content: content,
                    publishedDate: dateStr,
                    publishedTime: timeStr,
                    sourceUrl: item.link,
                    readingTime: Math.ceil(content.length / 1000) || 1,
                    isSaved: false,
                    isActive: true
                  });
                  await currentAffair.save();
                  newTopicsCount++;
                }
              } catch (err: any) {
                // Ignore duplicate key errors if they somehow occur
                if (err.code !== 11000) {
                  logger.error(`Error saving topic: ${currentTopicTitle} - ${err.message}`);
                }
              }
            }
          }
        };

        // Iterate through top-level elements in the article body
        const children = articleBody.children().toArray();
        logger.info(`Found ${children.length} top-level elements in article body`);
        
        for (const child of children) {
          const tag = child.tagName.toLowerCase();
          const $child = $(child);
          const text = $child.text().trim();
          
          if (!text) continue;

          // Skip introductory or promotional paragraphs
          if (text.match(/click here|join our|subscribe|download pdf|dear aspirants|we are here for you/i)) {
            continue;
          }

          let isHeading = false;
          let headingText = '';

          if (tag === 'h2' || tag === 'h3') {
            isHeading = true;
            headingText = text;
          } else if (tag === 'p') {
            // Check if the paragraph starts with a strong tag (often inside a span)
            // e.g., <p><span style="color: #0000ff;"><strong>Topic Title...</strong></span> Content...</p>
            const firstStrong = $child.find('strong, b').first();
            if (firstStrong.length > 0) {
              const strongText = firstStrong.text().trim();
              
              // Only consider it a new topic if the strong text is at the beginning of the paragraph
              // and it's long enough to be a title but not the entire paragraph (usually).
              // Also skip category headers like "NATIONAL AFFAIRS"
              if (text.startsWith(strongText) && strongText.length > 10 && strongText !== text && !strongText.match(/^[A-Z\s]+$/)) {
                isHeading = true;
                headingText = strongText;
                
                // Remove the title from the paragraph so it's not duplicated in content
                firstStrong.remove();
              } else if (strongText.match(/^(\d+\.|Q\.)\s.+/i)) {
                // Fallback for numbered headings
                isHeading = true;
                headingText = strongText;
                firstStrong.remove();
              }
            }
          }

          if (isHeading && headingText) {
            // Save the previous topic before starting a new one
            await saveCurrentTopic();
            
            // Start new topic
            currentTopicTitle = headingText.replace(/^(\d+\.|Q\.)\s*/, '').trim(); 
            currentTopicElements = [];
            
            // If it was a <p> tag, we still want to keep the rest of its text as the first content element!
            if (tag === 'p' && $child.text().trim().length > 0) {
              currentTopicElements.push(child);
            }
          } else {
            // Accumulate content for the current topic
            if (currentTopicTitle) {
              // Ignore sub-category red headings like "NATIONAL AFFAIRS"
              if (tag === 'p' && $child.find('strong, b').text().match(/^[A-Z\s]+$/) && text === $child.find('strong, b').text()) {
                continue;
              }
              currentTopicElements.push(child);
            }
          }
        }
        
        // Save the last topic
        await saveCurrentTopic();
      }

      logger.info(`✓ AffairsCloud Sync Success - Added ${newTopicsCount} new current affairs topics.`);
    } catch (error: any) {
      logger.error(`⚠ AffairsCloud Sync Failed: ${error.message}`);
    }
  }
}
