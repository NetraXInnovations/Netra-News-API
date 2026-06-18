import { db } from '../db/db';
import { RssIngestionService } from '../services/rssIngestionService';
import { ReadabilityService } from '../services/readabilityService';
import axios from 'axios';

async function run() {
  console.log('==================================================');
  console.log('         NETRA NEWS HUB PIPELINE VERIFICATION     ');
  console.log('==================================================\n');

  // 1. Verify DB Connection and Schema
  console.log('1. Database Connection and Tables Check:');
  try {
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tables = tableCheck.rows.map(r => r.table_name);
    console.log(`[CONNECTED] Success! Found tables: ${tables.join(', ')}`);
  } catch (err: any) {
    console.error(`[ERROR] DB Connection/Schema Error: ${err.message}`);
    console.log('--------------------------------------------------');
    console.log('Tip: Make sure you ran the SQL commands from schema.sql');
    console.log('in your Supabase SQL Editor first, so the tables and exec_sql');
    console.log('helper exist. We route through HTTP RPC to avoid IPv6 timeouts.');
    console.log('--------------------------------------------------\n');
    return;
  }

  // 2. Query Row Counts
  console.log('\n2. Table Row Counts:');
  try {
    const counts = await db.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM languages) as languages,
        (SELECT COUNT(*)::int FROM categories) as categories,
        (SELECT COUNT(*)::int FROM rss_sources) as rss_sources,
        (SELECT COUNT(*)::int FROM articles) as articles,
        (SELECT COUNT(*)::int FROM saved_articles) as saved_articles
    `);
    const metrics = counts.rows[0];
    console.log(`- Languages:      ${metrics.languages}`);
    console.log(`- Categories:     ${metrics.categories}`);
    console.log(`- RSS Sources:    ${metrics.rss_sources}`);
    console.log(`- Articles:       ${metrics.articles}`);
    console.log(`- Saved Articles: ${metrics.saved_articles}`);
  } catch (err: any) {
    console.error(`[ERROR] Failed to query row counts: ${err.message}`);
  }

  // 3. Test Ingestion and Readability on 1 RSS Source
  console.log('\n3. RSS Parsing & Readability Content Extraction Test:');
  try {
    const sourcesRes = await db.query('SELECT id, source_name, rss_url FROM rss_sources WHERE enabled = true LIMIT 1');
    if (sourcesRes.rows.length === 0) {
      console.log('[SKIPPED] No enabled RSS sources found to test.');
    } else {
      const source = sourcesRes.rows[0];
      console.log(`- Selected feed for test: "${source.source_name}" (${source.rss_url})`);
      
      // Load feed XML via Parser
      const Parser = require('rss-parser');
      const parser = new Parser();
      const feed = await parser.parseURL(source.rss_url);
      const items = feed.items || [];
      console.log(`- Feed URL fetched successfully! Found ${items.length} items.`);
      
      if (items.length > 0) {
        const testItem = items[0];
        const testLink = testItem.link || testItem.guid;
        console.log(`- Test article link: ${testLink}`);
        
        console.log('- Running Readability content extraction...');
        const extracted = await ReadabilityService.extract(testLink);
        if (extracted) {
          console.log(`  [SUCCESS] Extracted Title: "${extracted.title}"`);
          console.log(`  [SUCCESS] Est. Reading Time: ${extracted.readingTime} min`);
          console.log(`  [SUCCESS] Clean Content Length: ${extracted.content.length} characters`);
          console.log('  Content Preview (first 120 chars):');
          console.log(`  "${extracted.content.substring(0, 120)}..."`);
        } else {
          console.log('  [FAILED] Readability returned null.');
        }
      }
    }
  } catch (err: any) {
    console.error(`[ERROR] Ingestion test failed: ${err.message}`);
  }

  // 4. Query Sample Article
  console.log('\n4. Sample Article Record in Database:');
  try {
    const articleRes = await db.query('SELECT id, title, reading_time, published_at FROM articles LIMIT 1');
    if (articleRes.rows.length > 0) {
      console.log(JSON.stringify(articleRes.rows[0], null, 2));
    } else {
      console.log('No articles stored in database yet. Run ingestion to fetch articles.');
    }
  } catch (err: any) {
    console.error(`[ERROR] Failed to query article: ${err.message}`);
  }

  // 5. Test Endpoints (Mock Request)
  console.log('\n5. Mock Endpoint Tests:');
  try {
    // Languages endpoint test
    const langRes = await db.query('SELECT name, code FROM languages WHERE enabled = true');
    console.log('- Mock Response for GET /languages:');
    console.log(JSON.stringify({
      success: true,
      message: 'Languages retrieved successfully',
      timestamp: new Date().toISOString(),
      data: langRes.rows
    }, null, 2));

    // Categories endpoint test
    const catRes = await db.query(`
      SELECT c.name as category, l.name as language 
      FROM categories c 
      JOIN languages l ON c.language_id = l.id 
      WHERE c.enabled = true AND LOWER(l.name) = 'english' 
      LIMIT 3
    `);
    console.log('- Mock Response preview for GET /categories?language=english:');
    console.log(JSON.stringify({
      success: true,
      message: 'Categories retrieved successfully',
      timestamp: new Date().toISOString(),
      data: catRes.rows
    }, null, 2));
  } catch (err: any) {
    console.error(`[ERROR] Mock endpoint queries failed: ${err.message}`);
  }
}

run();
