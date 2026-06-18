import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logger } from '../config/logger';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.warn('SUPABASE_URL or SUPABASE_ANON_KEY environment variable is missing.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export const db = {
  query: async (text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> => {
    const start = Date.now();
    try {
      let sql = text;
      
      // Substitute placeholders ($1, $2, etc.) safely in the SQL string
      if (params && params.length > 0) {
        params.forEach((val, idx) => {
          const placeholder = `$${idx + 1}`;
          let formattedVal: string;
          
          if (val === null || val === undefined) {
            formattedVal = 'NULL';
          } else if (typeof val === 'string') {
            formattedVal = `'${val.replace(/'/g, "''")}'`;
          } else if (val instanceof Date) {
            formattedVal = `'${val.toISOString()}'`;
          } else if (typeof val === 'object') {
            formattedVal = `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
          } else {
            formattedVal = String(val);
          }
          
          sql = sql.split(placeholder).join(formattedVal);
        });
      }

      // Execute SQL via the exec_sql RPC helper over IPv4 HTTPS (Port 443)
      const { data, error } = await supabase.rpc('exec_sql', { query_text: sql });

      if (error) {
        throw new Error(error.message);
      }
      if (data && data.error) {
        throw new Error(data.error);
      }

      const rows = Array.isArray(data) ? data : [];
      const duration = Date.now() - start;
      logger.debug({ duration, rowsCount: rows.length }, 'HTTP SQL query executed');

      return {
        rows,
        rowCount: rows.length
      };
    } catch (error: any) {
      logger.error({ text, error: error.message }, 'Database query error');
      throw error;
    }
  }
};

// Export pool object for backwards compatibility in standalone scripts
export const pool = {
  end: async () => {
    // No-op for HTTP client connection
  }
};
