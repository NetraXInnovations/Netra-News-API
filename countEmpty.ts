import { connectDB } from './src/db/db';
import { Article } from './src/models/Article';

async function run() {
  await connectDB();
  const emptyCount = await Article.countDocuments({
    $or: [
      { content: '' },
      { description: '' },
      { content: { $exists: false } }
    ]
  });
  console.log('Empty Count:', emptyCount);
  
  // Actually, delete them so they get re-fetched properly!
  if (emptyCount > 0) {
    const delResult = await Article.deleteMany({
      $or: [
        { content: '' },
        { description: '' },
        { content: { $exists: false } }
      ]
    });
    console.log('Deleted:', delResult.deletedCount);
  }
  process.exit(0);
}
run();
