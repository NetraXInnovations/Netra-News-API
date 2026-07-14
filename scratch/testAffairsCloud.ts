import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';

async function test() {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL('https://affairscloud.com/feed/');
    const firstItem = feed.items.find(i => i.title?.toLowerCase().includes('current affairs'));
    
    if (!firstItem) return console.log('No current affairs item found');
    
    console.log('Fetching:', firstItem.link);
    const res = await axios.get(firstItem.link!, { timeout: 15000 });
    const $ = cheerio.load(res.data);
    
    const article = $('article').first();
    const articleBody = article.find('.td-post-content, .post-content, .entry-content').first();
    
    if (articleBody.length) {
      console.log('Found articleBody with children:', articleBody.children().length);
      const children = articleBody.children().toArray();
      for (let i = 0; i < 20; i++) {
        if (!children[i]) continue;
        const tag = children[i].tagName.toLowerCase();
        const text = $(children[i]).text().trim().substring(0, 100).replace(/\n/g, ' ');
        const html = $(children[i]).html()?.substring(0, 50) || '';
        console.log(`[${i}] ${tag}: ${text}`);
        console.log(`    HTML: ${html}`);
      }
    } else {
      console.log('articleBody not found');
    }
  } catch (e: any) {
    console.error('Error fetching:', e.message);
  }
}
test();
