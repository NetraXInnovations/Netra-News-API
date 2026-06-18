-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Secure SQL execution RPC wrapper for HTTP IPv4 routing (Supports SELECT, INSERT/UPDATE/DELETE with RETURNING, and direct writes/DDL)
CREATE OR REPLACE FUNCTION exec_sql(query_text text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  upper_query text;
BEGIN
  -- Strip all leading whitespaces, including newlines and tabs, then convert to uppercase
  upper_query := regexp_replace(upper(query_text), '^\s+', '');
  
  IF upper_query LIKE 'SELECT%' OR upper_query LIKE 'WITH%' THEN
    -- SELECT and normal CTEs wrapped in standard SELECT FROM
    EXECUTE 'SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM (' || query_text || ') t' INTO result;
  ELSIF query_text ~* '\yreturning\y' THEN
    -- Data-modifying queries (INSERT/UPDATE/DELETE) with RETURNING clause
    EXECUTE 'WITH t AS (' || query_text || ') SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM t' INTO result;
  ELSE
    -- Data-modifying queries (INSERT/UPDATE/DELETE) without RETURNING, or DDL
    EXECUTE query_text;
    result := '[]'::jsonb;
  END IF;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1. LANGUAGES TABLE
CREATE TABLE IF NOT EXISTS languages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  code VARCHAR(10) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CATEGORY TABLE
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(language_id, name)
);

-- 3. RSS SOURCE TABLE
CREATE TABLE IF NOT EXISTS rss_sources (
  id SERIAL PRIMARY KEY,
  language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  source_name VARCHAR(100) NOT NULL,
  rss_url TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ARTICLE TABLE
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  reading_time INTEGER NOT NULL DEFAULT 0,
  is_saved BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 5. SAVED ARTICLES TABLE
CREATE TABLE IF NOT EXISTS saved_articles (
  id SERIAL PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE UNIQUE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. SYNC LOGS TABLE
CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  rss_source_id INTEGER NOT NULL REFERENCES rss_sources(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL, -- 'success', 'failure'
  articles_found INTEGER NOT NULL DEFAULT 0,
  articles_imported INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. SYSTEM LOGS TABLE
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  log_level VARCHAR(20) NOT NULL,
  action VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_categories_language ON categories(language_id);
CREATE INDEX IF NOT EXISTS idx_rss_sources_lang_cat ON rss_sources(language_id, category_id);
CREATE INDEX IF NOT EXISTS idx_articles_lang_cat ON articles(language_id, category_id);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_articles_article_id ON saved_articles(article_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_rss_source ON sync_logs(rss_source_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);


-- =========================================================================
--                               SEED DATA
-- =========================================================================

-- 1. Populating languages
INSERT INTO languages (id, name, code, enabled) VALUES
(1, 'English', 'en', true),
(2, 'Hindi', 'hi', true),
(3, 'Telugu', 'te', true),
(4, 'Tamil', 'ta', true)
ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled;

-- Reset serial sequences for languages
SELECT setval('languages_id_seq', 4);

-- 2. Populating categories
INSERT INTO categories (id, language_id, name, enabled) VALUES
-- English Categories (id: 1 - 16)
(1, 1, 'India', true),
(2, 1, 'World', true),
(3, 1, 'States', true),
(4, 1, 'Sports', true),
(5, 1, 'Cricket', true),
(6, 1, 'Technology', true),
(7, 1, 'Business', true),
(8, 1, 'Health', true),
(9, 1, 'Entertainment', true),
(10, 1, 'Science', true),
(11, 1, 'Education', true),
(12, 1, 'Economy', true),
(13, 1, 'Politics', true),
(14, 1, 'Lifestyle', true),
(15, 1, 'People', true),
(16, 1, 'Arts & Culture', true),

-- Hindi Categories (id: 17 - 28)
(17, 2, 'भारत', true),
(18, 2, 'दुनिया', true),
(19, 2, 'राज्य', true),
(20, 2, 'खेल', true),
(21, 2, 'क्रिकेट', true),
(22, 2, 'टेक्नोलॉजी', true),
(23, 2, 'बिज़नेस', true),
(24, 2, 'सेहत', true),
(25, 2, 'मनोरंजन', true),
(26, 2, 'विज्ञान', true),
(27, 2, 'शिक्षा', true),
(28, 2, 'लाइफ़स्टाइल', true),

-- Telugu Categories (id: 29 - 41)
(29, 3, 'ఆంధ్రప్రదేశ్', true),
(30, 3, 'తెలంగాణ', true),
(31, 3, 'భారతదేశం', true),
(32, 3, 'ప్రపంచం', true),
(33, 3, 'క్రీడలు', true),
(34, 3, 'క్రికెట్', true),
(35, 3, 'సాంకేతికత', true),
(36, 3, 'వ్యాపారం', true),
(37, 3, 'ఆరోగ్యం', true),
(38, 3, 'వినోదం', true),
(39, 3, 'విజ్ఞానశాస్త్రం', true),
(40, 3, 'రాజకీయాలు', true),
(41, 3, 'జీవనశైలి', true),

-- Tamil Categories (id: 42 - 54)
(42, 4, 'தமிழ்நாடு', true),
(43, 4, 'இந்தியா', true),
(44, 4, 'உலகம்', true),
(45, 4, 'வாழ்க்கை முறை', true),
(46, 4, 'கல்வி', true),
(47, 4, 'விளையாட்டு', true),
(48, 4, 'கிரிக்கெட்', true),
(49, 4, 'தொழில்நுட்பம்', true),
(50, 4, 'வணிகம்', true),
(51, 4, 'சுகாதாரம்', true),
(52, 4, 'பொழுதுபோக்கு', true),
(53, 4, 'அறிவியல்', true),
(54, 4, 'வாகனங்கள்', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled;

-- Reset serial sequences for categories
SELECT setval('categories_id_seq', 54);

-- 3. Populating RSS Sources
INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
-- English RSS Feeds
(1, 1, 'The Hindu - National', 'https://www.thehindu.com/news/national/feeder/default.rss', true, 1),
(1, 2, 'The Hindu - International', 'https://www.thehindu.com/news/international/feeder/default.rss', true, 1),
(1, 3, 'India Today - States', 'https://www.indiatoday.in/rss/1206500', true, 1),
(1, 4, 'India Today - Sports', 'https://www.indiatoday.in/rss/1206550', true, 1),
(1, 5, 'Times of India - Cricket', 'https://timesofindia.indiatimes.com/rssfeeds/54829575.cms', true, 1),
(1, 6, 'Times of India - Technology', 'https://timesofindia.indiatimes.com/rssfeeds/66949542.cms', true, 1),
(1, 7, 'Times of India - Business', 'https://timesofindia.indiatimes.com/rssfeeds/1898055.cms', true, 1),
(1, 8, 'NDTV Cooks - Health', 'https://feeds.feedburner.com/ndtvcooks-latest', true, 1),
(1, 10, 'Times of India - Science', 'https://timesofindia.indiatimes.com/rssfeeds/-2128672765.cms', true, 1),
(1, 11, 'Times of India - Education', 'https://timesofindia.indiatimes.com/rssfeeds/913168846.cms', true, 1),
(1, 12, 'Frontline - Economy', 'https://frontline.thehindu.com/economy/feeder/default.rss', true, 1),
(1, 13, 'News18 - Politics', 'https://www.news18.com/commonfeeds/v1/eng/rss/politics.xml', true, 1),
(1, 14, 'Times of India - Lifestyle', 'https://timesofindia.indiatimes.com/rssfeeds/2886704.cms', true, 1),
(1, 15, 'NDTV News - People', 'https://feeds.feedburner.com/ndtvnews-people', true, 1),
(1, 16, 'Frontline - Arts & Culture', 'https://frontline.thehindu.com/arts-and-culture/feeder/default.rss', true, 1),

-- Hindi RSS Feeds
(2, 17, 'Dainik Bhaskar - India', 'https://www.bhaskar.com/rss-v1--category-1061.xml', true, 1),
(2, 18, 'Dainik Bhaskar - World', 'https://www.bhaskar.com/rss-v1--category-1125.xml', true, 1),
(2, 19, 'News18 Hindi - States', 'https://hindi.news18.com/commonfeeds/v1/hin/rss/states.xml', true, 1),
(2, 20, 'Dainik Bhaskar - Sports', 'https://www.bhaskar.com/rss-v1--category-1053.xml', true, 1),
(2, 21, 'News18 Hindi - Cricket', 'https://hindi.news18.com/commonfeeds/v1/hin/rss/sports/cricket.xml', true, 1),
(2, 22, 'Dainik Bhaskar - Technology', 'https://www.bhaskar.com/rss-v1--category-5707.xml', true, 1),
(2, 23, 'Dainik Bhaskar - Business', 'https://www.bhaskar.com/rss-v1--category-1051.xml', true, 1),
(2, 24, 'News18 Hindi - Health', 'https://hindi.news18.com/commonfeeds/v1/hin/rss/lifestyle/health.xml', true, 1),
(2, 25, 'Dainik Bhaskar - Entertainment', 'https://www.bhaskar.com/rss-v1--category-3998.xml', true, 1),
(2, 26, 'Gadgets360 - Science', 'https://hindi.gadgets360.com/rss/science/news', true, 1),
(2, 27, 'India TV - Education', 'https://www.indiatv.in/rssnews/topstory-education.xml', true, 1),
(2, 28, 'India TV - Lifestyle', 'https://www.indiatv.in/rssnews/topstory-lifestyle.xml', true, 1),

-- Telugu RSS Feeds
(3, 29, 'News18 Telugu - Andhra Pradesh', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/andhra-pradesh.xml', true, 1),
(3, 30, 'News18 Telugu - Telangana', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/telangana.xml', true, 1),
(3, 31, 'News18 Telugu - India', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/national.xml', true, 1),
(3, 32, 'News18 Telugu - World', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/international.xml', true, 1),
(3, 33, 'News18 Telugu - Sports', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/sports.xml', true, 1),
(3, 34, 'News18 Telugu - Cricket', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/cricket.xml', true, 1),
(3, 35, 'News18 Telugu - Technology', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/technology.xml', true, 1),
(3, 36, 'News18 Telugu - Business', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/business.xml', true, 1),
(3, 37, 'News18 Telugu - Health', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/life-style/health.xml', true, 1),
(3, 38, 'OneIndia Telugu - Entertainment', 'https://telugu.oneindia.com/rss/feeds/telugu-entertainment-fb.xml', true, 1),
(3, 39, 'News18 Telugu - Science', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/science.xml', true, 1),
(3, 40, 'News18 Telugu - Politics', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/national/politics-national.xml', true, 1),
(3, 41, 'News18 Telugu - Lifestyle', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/life-style.xml', true, 1),

-- Tamil RSS Feeds
(4, 42, 'News18 Tamil - Tamil Nadu', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/tamil-nadu.xml', true, 1),
(4, 43, 'Vikatan - India', 'https://www.vikatan.com/api/v1/collections/india-news.rss', true, 1),
(4, 44, 'Vikatan - World', 'https://www.vikatan.com/api/v1/collections/international.rss', true, 1),
(4, 45, 'News18 Tamil - Lifestyle', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/lifestyle.xml', true, 1),
(4, 46, 'News18 Tamil - Education', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/education.xml', true, 1),
(4, 47, 'News18 Tamil - Sports', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/sports.xml', true, 1),
(4, 48, 'News18 Tamil - Cricket', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/sports/cricket.xml', true, 1),
(4, 49, 'Vikatan - Technology', 'https://www.vikatan.com/stories.rss?section-id=8968', true, 1),
(4, 50, 'News18 Tamil - Business', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/business.xml', true, 1),
(4, 51, 'Vikatan - Health', 'https://www.vikatan.com/stories.rss?section-id=8963', true, 1),
(4, 52, 'Vikatan - Entertainment', 'https://www.vikatan.com/stories.rss?section-id=8956', true, 1),
(4, 53, 'Vikatan - Science', 'https://www.vikatan.com/stories.rss?section-id=8965', true, 1),
(4, 54, 'News18 Tamil - Automobile', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/automobile.xml', true, 1)
ON CONFLICT (rss_url) DO NOTHING;
