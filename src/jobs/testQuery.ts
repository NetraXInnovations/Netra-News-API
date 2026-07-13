import { db, initFirebase } from '../db/db';

async function testQuery() {
  initFirebase();
  try {
    let query: FirebaseFirestore.Query = db.collection('articles');

    query = query.where('language', '==', 'english');
    query = query.where('category', '==', 'national');

    const snapshot = await query.get();
    
    let allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    console.log(`Found ${allDocs.length} documents.`);
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testQuery();
