import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting French language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (15, 'French', 'fr', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language French added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (234, 15, 'France', true),
      (235, 15, 'Monde', true),
      (236, 15, 'Europe', true),
      (237, 15, 'Politique', true),
      (238, 15, 'Économie', true),
      (239, 15, 'Technologie', true),
      (240, 15, 'Science', true),
      (241, 15, 'Santé', true),
      (242, 15, 'Sport', true),
      (243, 15, 'Football', true),
      (244, 15, 'Divertissement', true),
      (245, 15, 'Éducation', true),
      (246, 15, 'Culture', true),
      (247, 15, 'Voyage', true),
      (248, 15, 'Automobile', true),
      (249, 15, 'Startups', true),
      (250, 15, 'Actualités', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('French categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (15, 234, 'Le Monde - France', 'https://www.lemonde.fr/rss/une.xml', true, 1),
      (15, 234, 'Le Figaro - France', 'https://www.lefigaro.fr/rss/figaro_actualites.xml', true, 1),
      (15, 235, 'France 24 - Monde', 'https://www.france24.com/fr/rss', true, 1),
      (15, 235, 'Le Monde - Monde', 'https://www.lemonde.fr/international/rss_full.xml', true, 1),
      (15, 236, 'France 24 - Europe', 'https://www.france24.com/fr/europe/rss', true, 1),
      (15, 236, 'Le Monde - Europe', 'https://www.lemonde.fr/europe/rss_full.xml', true, 1),
      (15, 237, 'Le Figaro - Politique', 'https://www.lefigaro.fr/rss/figaro_politique.xml', true, 1),
      (15, 237, 'Le Monde - Politique', 'https://www.lemonde.fr/politique/rss_full.xml', true, 1),
      (15, 238, 'Le Monde - Économie', 'https://www.lemonde.fr/economie/rss_full.xml', true, 1),
      (15, 238, 'Les Echos - Économie', 'https://www.lesechos.fr/rss/rss_une.xml', true, 1),
      (15, 239, 'France 24 - Technologie', 'https://www.france24.com/fr/sciences-technologies/rss', true, 1),
      (15, 239, 'Le Monde - Technologie', 'https://www.lemonde.fr/pixels/rss_full.xml', true, 1),
      (15, 240, 'France 24 - Science', 'https://www.france24.com/fr/sciences-technologies/rss?cat=science', true, 1),
      (15, 240, 'Le Monde - Science', 'https://www.lemonde.fr/sciences/rss_full.xml', true, 1),
      (15, 241, 'Le Monde - Santé', 'https://www.lemonde.fr/sante/rss_full.xml', true, 1),
      (15, 241, 'France 24 - Santé', 'https://www.france24.com/fr/sciences-technologies/rss?cat=health', true, 1),
      (15, 242, 'L''Équipe - Sport', 'https://www.lequipe.fr/rss/actu_rss.xml', true, 1),
      (15, 242, 'France 24 - Sport', 'https://www.france24.com/fr/sports/rss', true, 1),
      (15, 243, 'L''Équipe - Football', 'https://www.lequipe.fr/rss/actu_rss_Football.xml', true, 1),
      (15, 243, 'France 24 - Football', 'https://www.france24.com/fr/sports/rss?cat=football', true, 1),
      (15, 244, 'Le Figaro - Divertissement', 'https://www.lefigaro.fr/rss/figaro_culture.xml', true, 1),
      (15, 244, 'France 24 - Divertissement', 'https://www.france24.com/fr/culture/rss', true, 1),
      (15, 245, 'Le Monde - Éducation', 'https://www.lemonde.fr/campus/rss_full.xml', true, 1),
      (15, 245, 'Le Figaro - Éducation', 'https://www.lefigaro.fr/rss/figaro_etudiant.xml', true, 1),
      (15, 246, 'France 24 - Culture', 'https://www.france24.com/fr/culture/rss?cat=culture', true, 1),
      (15, 246, 'Le Figaro - Culture', 'https://www.lefigaro.fr/rss/figaro_culture.xml?cat=culture', true, 1),
      (15, 247, 'Le Figaro - Voyage', 'https://www.lefigaro.fr/rss/figaro_voyages.xml', true, 1),
      (15, 247, 'France 24 - Voyage', 'https://www.france24.com/fr/rss?cat=travel', true, 1),
      (15, 248, 'Le Figaro - Automobile', 'https://www.lefigaro.fr/rss/figaro_auto.xml', true, 1),
      (15, 248, 'Les Echos - Automobile', 'https://www.lesechos.fr/rss/rss_une.xml?cat=auto', true, 1),
      (15, 249, 'Les Echos - Startups', 'https://www.lesechos.fr/rss/rss_une.xml?cat=startups', true, 1),
      (15, 249, 'Le Monde - Startups', 'https://www.lemonde.fr/economie/rss_full.xml?cat=startups', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('French RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run French migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
