import { connectDB } from '../src/db/db';
import { CurrentAffair } from '../src/models/CurrentAffair';

async function clearOldAffairs() {
  try {
    await connectDB();
    const result = await CurrentAffair.deleteMany({});
    console.log(`Deleted ${result.deletedCount} old current affairs documents.`);
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

clearOldAffairs();
