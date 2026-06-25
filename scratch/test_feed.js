const axios = require('axios');
const cheerio = require('cheerio');

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

async function test() {
  const url = 'https://affairscloud.com/current-affairs-20-june-2026/';
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const postContent = $('.td-post-content');
    
    if (postContent.length === 0) {
      console.log('No .td-post-content found');
      return;
    }
    
    const articles = [];
    let currentCategory = 'India'; // Default
    let currentArticle = null;
    
    // We will iterate over all elements inside .td-post-content
    postContent.children().each((i, el) => {
      const $el = $(el);
      const tagName = el.tagName.toLowerCase();
      const text = $el.text().trim();
      if (!text) return;
      
      // 1. Detect Category Header (Red text)
      // Example: <span style="color: #ff0000;"><strong>NATIONAL AFFAIRS</strong></span>
      const redSpan = $el.find('span[style*="color: #ff0000"], span[style*="color: rgb(255, 0, 0)"]');
      if (redSpan.length > 0 && redSpan.text().trim().match(/^[A-Z\s&]+$/)) {
        const catText = redSpan.text().trim();
        console.log(`\n>> Found Category Header: ${catText}`);
        currentCategory = catText;
        return;
      }
      
      // 2. Detect Headline (Blue text)
      // Example: <span style="color: #0000ff;"><strong>Headline text</strong></span>
      const blueSpan = $el.find('span[style*="color: #0000ff"], span[style*="color: rgb(0, 0, 255)"]');
      
      // Also check if the paragraph itself or a heading starts a new article (e.g. Q1, H2, H3, or starts with Q1.)
      const isQuestion = text.match(/^Q\d+\./i) || text.startsWith('Current Affairs Question');
      const isHeadline = blueSpan.length > 0 || tagName === 'h2' || tagName === 'h3' || isQuestion;
      
      if (isHeadline) {
        let headlineText = '';
        if (blueSpan.length > 0) {
          headlineText = blueSpan.text().trim();
        } else {
          headlineText = text;
        }
        
        // Clean up title
        headlineText = headlineText.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (headlineText.length > 15 && !headlineText.toLowerCase().includes('click here') && !headlineText.toLowerCase().includes('current affairs')) {
          if (currentArticle) {
            articles.push(currentArticle);
          }
          
          // Start content with whatever text is in the paragraph AFTER the blue span
          let initialContent = '';
          if (blueSpan.length > 0) {
            // Remove the blue span text from the paragraph HTML/text
            const clonedEl = $el.clone();
            clonedEl.find('span[style*="color: #0000ff"], span[style*="color: rgb(0, 0, 255)"]').remove();
            initialContent = clonedEl.text().trim();
          }
          
          currentArticle = {
            title: headlineText,
            category: currentCategory,
            contentParts: initialContent ? [initialContent] : [],
            sourceUrl: `${url}#${slugify(headlineText)}`
          };
          
          console.log(`Started Article: "${headlineText}" in Category: ${currentCategory}`);
          return;
        }
      }
      
      // 3. Append content to the current article
      if (currentArticle) {
        // Skip share links/boilerplates
        const lowerText = text.toLowerCase();
        if (
          lowerText.includes('click here for') ||
          lowerText.includes('we are hiring') ||
          lowerText.includes('subject matter expert') ||
          lowerText.includes('sharing and legal compliance') ||
          lowerText.includes('careerscloud app')
        ) {
          return;
        }
        
        // Add paragraph or list text
        currentArticle.contentParts.push(text);
      }
    });
    
    if (currentArticle) {
      articles.push(currentArticle);
    }
    
    console.log(`\n--- Extracted ${articles.length} sub-articles ---`);
    articles.slice(0, 3).forEach((art, index) => {
      console.log(`\nARTICLE ${index + 1}:`);
      console.log('Title:', art.title);
      console.log('Category:', art.category);
      console.log('Source URL:', art.sourceUrl);
      console.log('Content Preview:', art.contentParts.join('\n\n').substring(0, 400));
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
