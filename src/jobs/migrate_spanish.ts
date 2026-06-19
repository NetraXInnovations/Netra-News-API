import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Spanish language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (16, 'Spanish', 'es', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Spanish added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (251, 16, 'España', true),
      (252, 16, 'Mundo', true),
      (253, 16, 'Latinoamérica', true),
      (254, 16, 'Política', true),
      (255, 16, 'Economía', true),
      (256, 16, 'Tecnología', true),
      (257, 16, 'Ciencia', true),
      (258, 16, 'Salud', true),
      (259, 16, 'Deportes', true),
      (260, 16, 'Fútbol', true),
      (261, 16, 'Entretenimiento', true),
      (262, 16, 'Educación', true),
      (263, 16, 'Cultura', true),
      (264, 16, 'Viajes', true),
      (265, 16, 'Automóviles', true),
      (266, 16, 'Startups', true),
      (267, 16, 'Actualidad', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Spanish categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (16, 251, 'El País - España', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', true, 1),
      (16, 251, 'El Mundo - España', 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', true, 1),
      (16, 252, 'El País - Mundo', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada', true, 1),
      (16, 252, 'France 24 - Mundo', 'https://www.france24.com/es/rss', true, 1),
      (16, 253, 'El País - Latinoamérica', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada', true, 1),
      (16, 253, 'BBC Mundo - Latinoamérica', 'https://www.bbc.com/mundo/index.xml', true, 1),
      (16, 254, 'El País - Política', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/politica/portada', true, 1),
      (16, 254, 'El Mundo - Política', 'https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml', true, 1),
      (16, 255, 'El País - Economía', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada', true, 1),
      (16, 255, 'El Economista - Economía', 'https://www.eleconomista.es/rss/rss-empresas.php', true, 1),
      (16, 256, 'El País - Tecnología', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada', true, 1),
      (16, 256, 'Xataka - Tecnología', 'https://www.xataka.com/feedburner.xml', true, 1),
      (16, 257, 'El País - Ciencia', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia/portada', true, 1),
      (16, 257, 'Muy Interesante - Ciencia', 'https://www.muyinteresante.com/rss/', true, 1),
      (16, 258, 'El País - Salud', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/sociedad/salud-y-bienestar/portada', true, 1),
      (16, 258, 'Muy Interesante - Salud', 'https://www.muyinteresante.com/rss/?cat=salud', true, 1),
      (16, 259, 'El País - Deportes', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/portada', true, 1),
      (16, 259, 'Marca - Deportes', 'https://e00-marca.uecdn.es/rss/portada.xml', true, 1),
      (16, 260, 'Marca - Fútbol', 'https://e00-marca.uecdn.es/rss/futbol.xml', true, 1),
      (16, 260, 'El País - Fútbol', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/portada?cat=futbol', true, 1),
      (16, 261, 'El País - Entretenimiento', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada?cat=ent', true, 1),
      (16, 261, 'Europa Press - Entretenimiento', 'https://www.europapress.es/rss/rss.aspx?ch=00066', true, 1),
      (16, 262, 'El País - Educación', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/educacion/portada', true, 1),
      (16, 262, 'Europa Press - Educación', 'https://www.europapress.es/rss/rss.aspx', true, 1),
      (16, 263, 'El País - Cultura', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada', true, 1),
      (16, 263, 'France 24 - Cultura', 'https://www.france24.com/es/rss?cat=cultura', true, 1),
      (16, 264, 'El Viajero - Viajes', 'https://www.elviajero.elpais.com/rss/', true, 1),
      (16, 264, 'El País - Viajes', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada?cat=viajes', true, 1),
      (16, 265, 'Motorpasión - Automóviles', 'https://www.motorpasion.com/index.xml', true, 1),
      (16, 265, 'Coches.net - Automóviles', 'https://www.coches.net/rss/', true, 1),
      (16, 266, 'El Economista - Startups', 'https://www.eleconomista.es/rss/rss-empresas.php?cat=startups', true, 1),
      (16, 266, 'El País - Startups', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada?cat=startups', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Spanish RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Spanish migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
