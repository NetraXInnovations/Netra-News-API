import { connectDB } from '../src/db/db';
import { CurrentAffair } from '../src/models/CurrentAffair';

async function verify() {
  try {
    await connectDB();
    const total = await CurrentAffair.countDocuments({ isActive: true });
    console.log(`Total active current affairs: ${total}`);

    const sample = await CurrentAffair.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    if (sample) {
      console.log('\n--- Sample Document ---');
      console.log('Title:            ', sample.title);
      console.log('Summary:          ', sample.summary?.substring(0, 120) || '(empty)');
      console.log('Key Facts:        ', JSON.stringify(sample.keyFacts?.slice(0, 3)));
      console.log('Important Points: ', JSON.stringify(sample.importantPoints?.slice(0, 3)));
      console.log('Reading Time:     ', sample.readingTime, 'min');
      console.log('Content (100):    ', sample.content?.substring(0, 120));
    }
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

verify();
