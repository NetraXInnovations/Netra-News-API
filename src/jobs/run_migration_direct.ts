import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const sqlPath = path.join(__dirname, '../db/combined_setup.sql');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');

const connStrings = [
  // 1. Transaction Pooler (IPv4)
  'postgres://postgres.zpldizzgepgcdfnnfizv:NetraPlus%40%25630@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
  // 2. Session Pooler (IPv4)
  'postgres://postgres.zpldizzgepgcdfnnfizv:NetraPlus%40%25630@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres',
  // 3. Direct
  'postgresql://postgres:NetraPlus%40%25630@db.zpldizzgepgcdfnnfizv.supabase.co:5432/postgres'
];

async function tryConnectAndRun() {
  for (const connStr of connStrings) {
    console.log(`\nTrying connection string: ${connStr.replace(/:[^:@]+@/, ':****@')}`);
    const client = new Client({ 
      connectionString: connStr,
      ssl: {
        rejectUnauthorized: false
      }
    });
    try {
      await client.connect();
      console.log('CONNECTED successfully! Running combined SQL...');
      await client.query(sqlContent);
      console.log('SQL applied successfully!');
      await client.end();
      return;
    } catch (err: any) {
      console.error('Connection/Execution failed:', err.message);
      try {
        await client.end();
      } catch (e) {}
    }
  }
  console.log('\nAll connection methods failed.');
}

tryConnectAndRun();
