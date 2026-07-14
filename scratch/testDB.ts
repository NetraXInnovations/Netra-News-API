import { connectDB } from '../src/db/db';
import { CurrentAffair } from '../src/models/CurrentAffair';

async function test() {
  try {
    await connectDB();
    const affairs = await CurrentAffair.find({ isActive: true }).sort({ publishedDate: -1, publishedTime: -1, createdAt: -1 }).lean();
    console.log(`Found ${affairs.length} active current affairs.`);
    if (affairs.length > 0) {
      console.log('First affair title:', affairs[0].title);
      console.log('First affair ID:', affairs[0]._id.toString());
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

test();
