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
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_current_affairs BOOLEAN NOT NULL DEFAULT false
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
CREATE INDEX IF NOT EXISTS idx_articles_current_affairs ON articles(is_current_affairs) WHERE is_current_affairs = true;
