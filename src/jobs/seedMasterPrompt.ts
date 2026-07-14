import { connectDB } from '../db/db';
import { RssSource } from '../models/RssSource';
import { Category } from '../models/Category';
import { Language } from '../models/Language';
import { logger } from '../config/logger';

const allSources = [
  // --- ENGLISH ---
  { sourceName: "The Hindu - National", rssUrl: "https://www.thehindu.com/news/national/feeder/default.rss", language: "English", category: "India", englishName: "India", languageCode: "en" },
  { sourceName: "The Hindu - International", rssUrl: "https://www.thehindu.com/news/international/feeder/default.rss", language: "English", category: "World", englishName: "World", languageCode: "en" },
  { sourceName: "The Hindu - States", rssUrl: "https://www.thehindu.com/news/states/feeder/default.rss", language: "English", category: "States", englishName: "States", languageCode: "en" },
  { sourceName: "The Hindu - Sports", rssUrl: "https://www.thehindu.com/sport/feeder/default.rss", language: "English", category: "Sports", englishName: "Sports", languageCode: "en" },
  { sourceName: "The Hindu - Cricket", rssUrl: "https://www.thehindu.com/sport/cricket/feeder/default.rss", language: "English", category: "Cricket", englishName: "Cricket", languageCode: "en" },
  { sourceName: "The Hindu - Science", rssUrl: "https://www.thehindu.com/sci-tech/science/feeder/default.rss", language: "English", category: "Science", englishName: "Science", languageCode: "en" },
  { sourceName: "Times of India - Technology", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/66949542.cms", language: "English", category: "Technology", englishName: "Technology", languageCode: "en" },
  { sourceName: "Times of India - Business", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms", language: "English", category: "Business", englishName: "Business", languageCode: "en" },

  // --- HINDI ---
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/news/india/feed", language: "Hindi", category: "भारत", englishName: "India", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/news/world/feed", language: "Hindi", category: "विश्व", englishName: "World", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/states/feed", language: "Hindi", category: "राज्य", englishName: "States", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/sports/feed", language: "Hindi", category: "खेल", englishName: "Sports", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/business/feed", language: "Hindi", category: "व्यापार", englishName: "Business", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/technology/feed", language: "Hindi", category: "प्रौद्योगिकी", englishName: "Technology", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/education/feed", language: "Hindi", category: "शिक्षा", englishName: "Education", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/lifestyle/feed", language: "Hindi", category: "जीवनशैली", englishName: "Lifestyle", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/lifestyle/health/feed", language: "Hindi", category: "स्वास्थ्य", englishName: "Health", languageCode: "hi" },

  // --- TELUGU ---
  { sourceName: "News18 Telugu - Andhra Pradesh", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/andhra-pradesh.xml", language: "Telugu", category: "ఆంధ్రప్రదేశ్", englishName: "Andhra Pradesh", languageCode: "te" },
  { sourceName: "News18 Telugu - Telangana", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/telangana.xml", language: "Telugu", category: "తెలంగాణ", englishName: "Telangana", languageCode: "te" },
  { sourceName: "News18 Telugu - India", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/national.xml", language: "Telugu", category: "భారత్", englishName: "India", languageCode: "te" },
  { sourceName: "News18 Telugu - World", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/international.xml", language: "Telugu", category: "ప్రపంచం", englishName: "World", languageCode: "te" },
  { sourceName: "News18 Telugu - Technology", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/technology.xml", language: "Telugu", category: "సాంకేతికం", englishName: "Technology", languageCode: "te" },
  { sourceName: "News18 Telugu - Sports", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/sports.xml", language: "Telugu", category: "క్రీడలు", englishName: "Sports", languageCode: "te" },
  { sourceName: "News18 Telugu - Business", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/business.xml", language: "Telugu", category: "వ్యాపారం", englishName: "Business", languageCode: "te" },
  { sourceName: "News18 Telugu - Politics", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/national/politics-national.xml", language: "Telugu", category: "రాజకీయాలు", englishName: "Politics", languageCode: "te" },
  { sourceName: "News18 Telugu - Health", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/life-style/health.xml", language: "Telugu", category: "ఆరోగ్యం", englishName: "Health", languageCode: "te" },
  { sourceName: "News18 Telugu - Cricket", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/cricket.xml", language: "Telugu", category: "క్రికెట్", englishName: "Cricket", languageCode: "te" },

  // --- TAMIL ---
  { sourceName: "News18 Tamil - Tamil Nadu", rssUrl: "https://tamil.news18.com/commonfeeds/v1/tam/rss/tamil-nadu.xml", language: "Tamil", category: "தமிழ்நாடு", englishName: "Tamil Nadu", languageCode: "ta" },
  { sourceName: "News18 Tamil - India", rssUrl: "https://tamil.news18.com/commonfeeds/v1/tam/rss/national.xml", language: "Tamil", category: "இந்தியா", englishName: "India", languageCode: "ta" },
  { sourceName: "News18 Tamil - World", rssUrl: "https://tamil.news18.com/commonfeeds/v1/tam/rss/international.xml", language: "Tamil", category: "உலகம்", englishName: "World", languageCode: "ta" },
  { sourceName: "News18 Tamil - Education", rssUrl: "https://tamil.news18.com/commonfeeds/v1/tam/rss/education.xml", language: "Tamil", category: "கல்வி", englishName: "Education", languageCode: "ta" },
  { sourceName: "News18 Tamil - Technology", rssUrl: "https://tamil.news18.com/commonfeeds/v1/tam/rss/technology.xml", language: "Tamil", category: "தொழில்நுட்பம்", englishName: "Technology", languageCode: "ta" },
  { sourceName: "News18 Tamil - Business", rssUrl: "https://tamil.news18.com/commonfeeds/v1/tam/rss/business.xml", language: "Tamil", category: "வணிகம்", englishName: "Business", languageCode: "ta" },
  { sourceName: "News18 Tamil - Entertainment", rssUrl: "https://tamil.news18.com/commonfeeds/v1/tam/rss/entertainment.xml", language: "Tamil", category: "பொழுதுபோக்கு", englishName: "Entertainment", languageCode: "ta" },
  { sourceName: "News18 Tamil - Sports", rssUrl: "https://tamil.news18.com/commonfeeds/v1/tam/rss/sports.xml", language: "Tamil", category: "விளையாட்டு", englishName: "Sports", languageCode: "ta" },
  { sourceName: "News18 Tamil - Health", rssUrl: "https://tamil.news18.com/commonfeeds/v1/tam/rss/lifestyle/health.xml", language: "Tamil", category: "ஆரோக்கியம்", englishName: "Health", languageCode: "ta" },

  // --- KANNADA ---
  { sourceName: "News18 Kannada - Sports", rssUrl: "https://kannada.news18.com/commonfeeds/v1/kan/rss/sports.xml", language: "Kannada", category: "ಕ್ರೀಡೆ", englishName: "Sports", languageCode: "kn" },
  { sourceName: "News18 Kannada - Cricket", rssUrl: "https://kannada.news18.com/commonfeeds/v1/kan/rss/sports/cricket.xml", language: "Kannada", category: "ಕ್ರಿಕೆಟ್", englishName: "Cricket", languageCode: "kn" },
  { sourceName: "News18 Kannada - Business", rssUrl: "https://kannada.news18.com/commonfeeds/v1/kan/rss/business.xml", language: "Kannada", category: "ವ್ಯವಹಾರ", englishName: "Business", languageCode: "kn" },
  { sourceName: "News18 Kannada - Health", rssUrl: "https://kannada.news18.com/commonfeeds/v1/kan/rss/lifestyle/health.xml", language: "Kannada", category: "ಆರೋಗ್ಯ", englishName: "Health", languageCode: "kn" },
  { sourceName: "News18 Kannada - Education", rssUrl: "https://kannada.news18.com/commonfeeds/v1/kan/rss/jobs/education.xml", language: "Kannada", category: "ಶಿಕ್ಷಣ", englishName: "Education", languageCode: "kn" },
  { sourceName: "News18 Kannada - Technology", rssUrl: "https://kannada.news18.com/commonfeeds/v1/kan/rss/tech-trend.xml", language: "Kannada", category: "ತಂತ್ರಜ್ಞಾನ", englishName: "Technology", languageCode: "kn" },
  { sourceName: "News18 Kannada - Entertainment", rssUrl: "https://kannada.news18.com/commonfeeds/v1/kan/rss/entertainment.xml", language: "Kannada", category: "ಮನರಂಜನೆ", englishName: "Entertainment", languageCode: "kn" },

  // --- MALAYALAM ---
  { sourceName: "News18 Malayalam - India", rssUrl: "https://malayalam.news18.com/commonfeeds/v1/mal/rss/india.xml", language: "Malayalam", category: "ഇന്ത്യ", englishName: "India", languageCode: "ml" },
  { sourceName: "News18 Malayalam - World", rssUrl: "https://malayalam.news18.com/commonfeeds/v1/mal/rss/world.xml", language: "Malayalam", category: "ലോകം", englishName: "World", languageCode: "ml" },
  { sourceName: "News18 Malayalam - Sports", rssUrl: "https://malayalam.news18.com/commonfeeds/v1/mal/rss/sports.xml", language: "Malayalam", category: "കായികം", englishName: "Sports", languageCode: "ml" },
  { sourceName: "News18 Malayalam - Kerala", rssUrl: "https://malayalam.news18.com/commonfeeds/v1/mal/rss/kerala.xml", language: "Malayalam", category: "കേരളം", englishName: "Kerala", languageCode: "ml" },
  { sourceName: "News18 Malayalam - Technology", rssUrl: "https://malayalam.news18.com/commonfeeds/v1/mal/rss/money/tech.xml", language: "Malayalam", category: "സാങ്കേതികവിദ്യ", englishName: "Technology", languageCode: "ml" },
  { sourceName: "News18 Malayalam - Health", rssUrl: "https://malayalam.news18.com/commonfeeds/v1/mal/rss/life/health.xml", language: "Malayalam", category: "ആരോഗ്യം", englishName: "Health", languageCode: "ml" },
  { sourceName: "News18 Malayalam - Lifestyle", rssUrl: "https://malayalam.news18.com/commonfeeds/v1/mal/rss/life.xml", language: "Malayalam", category: "ജീവിതശൈലി", englishName: "Lifestyle", languageCode: "ml" },

  // --- MARATHI ---
  { sourceName: "Divya Marathi - Maharashtra", rssUrl: "https://divyamarathi.bhaskar.com/rss-v1--category-5492.xml", language: "Marathi", category: "महाराष्ट्र", englishName: "Maharashtra", languageCode: "mr" },
  { sourceName: "Divya Marathi - National", rssUrl: "https://divyamarathi.bhaskar.com/rss-v1--category-5489.xml", language: "Marathi", category: "राष्ट्रीय", englishName: "National", languageCode: "mr" },
  { sourceName: "Divya Marathi - International", rssUrl: "https://divyamarathi.bhaskar.com/rss-v1--category-5490.xml", language: "Marathi", category: "आंतरराष्ट्रीय", englishName: "International", languageCode: "mr" },
  { sourceName: "Divya Marathi - Sports", rssUrl: "https://divyamarathi.bhaskar.com/rss-v1--category-5491.xml", language: "Marathi", category: "क्रीडा", englishName: "Sports", languageCode: "mr" },
  { sourceName: "Divya Marathi - Entertainment", rssUrl: "https://divyamarathi.bhaskar.com/rss-v1--category-12018.xml", language: "Marathi", category: "मनोरंजन", englishName: "Entertainment", languageCode: "mr" },
  { sourceName: "Divya Marathi - Business", rssUrl: "https://divyamarathi.bhaskar.com/rss-v1--category-5558.xml", language: "Marathi", category: "व्यवसाय", englishName: "Business", languageCode: "mr" },
  { sourceName: "Divya Marathi - Technology & Auto", rssUrl: "https://divyamarathi.bhaskar.com/rss-v1--category-12023.xml", language: "Marathi", category: "तंत्रज्ञान आणि ऑटो", englishName: "Technology & Auto", languageCode: "mr" },
  { sourceName: "Divya Marathi - Lifestyle", rssUrl: "https://divyamarathi.bhaskar.com/rss-v1--category-12021.xml", language: "Marathi", category: "जीवनशैली", englishName: "Lifestyle", languageCode: "mr" },

  // --- BENGALI ---
  { sourceName: "News18 Bengali - Kolkata", rssUrl: "https://bengali.news18.com/commonfeeds/v1/ben/rss/kolkata.xml", language: "Bengali", category: "কলকাতা", englishName: "Kolkata", languageCode: "bn" },
  { sourceName: "News18 Bengali - West Bengal", rssUrl: "https://bengali.news18.com/commonfeeds/v1/ben/rss/west-bengal.xml", language: "Bengali", category: "পশ্চিমবঙ্গ", englishName: "West Bengal", languageCode: "bn" },
  { sourceName: "News18 Bengali - Technology", rssUrl: "https://bengali.news18.com/commonfeeds/v1/ben/rss/technology.xml", language: "Bengali", category: "প্রযুক্তি", englishName: "Technology", languageCode: "bn" },
  { sourceName: "News18 Bengali - Entertainment", rssUrl: "https://bengali.news18.com/commonfeeds/v1/ben/rss/entertainment.xml", language: "Bengali", category: "বিনোদন", englishName: "Entertainment", languageCode: "bn" },
  { sourceName: "News18 Bengali - Business", rssUrl: "https://bengali.news18.com/commonfeeds/v1/ben/rss/business.xml", language: "Bengali", category: "ব্যবসা", englishName: "Business", languageCode: "bn" },
  { sourceName: "News18 Bengali - Politics", rssUrl: "https://bengali.news18.com/commonfeeds/v1/ben/rss/politics.xml", language: "Bengali", category: "রাজনীতি", englishName: "Politics", languageCode: "bn" },
  { sourceName: "News18 Bengali - Lifestyle", rssUrl: "https://bengali.news18.com/commonfeeds/v1/ben/rss/life-style.xml", language: "Bengali", category: "লাইফস্টাইল", englishName: "Lifestyle", languageCode: "bn" },
  { sourceName: "News18 Bengali - Education & Career", rssUrl: "https://bengali.news18.com/commonfeeds/v1/ben/rss/education-career.xml", language: "Bengali", category: "শিক্ষা ও ক্যারিয়ার", englishName: "Education & Career", languageCode: "bn" },

  // --- GUJARATI ---
  { sourceName: "Divya Bhaskar - Gujarat", rssUrl: "https://www.divyabhaskar.co.in/rss-v1--category-1035.xml", language: "Gujarati", category: "ગુજરાત", englishName: "Gujarat", languageCode: "gu" },
  { sourceName: "Divya Bhaskar - National", rssUrl: "https://www.divyabhaskar.co.in/rss-v1--category-1037.xml", language: "Gujarati", category: "રાષ્ટ્રીય", englishName: "National", languageCode: "gu" },
  { sourceName: "Divya Bhaskar - International", rssUrl: "https://www.divyabhaskar.co.in/rss-v1--category-1038.xml", language: "Gujarati", category: "આંતરરાષ્ટ્રીય", englishName: "International", languageCode: "gu" },
  { sourceName: "Divya Bhaskar - Entertainment", rssUrl: "https://www.divyabhaskar.co.in/rss-v1--category-12018.xml", language: "Gujarati", category: "મનોરંજન", englishName: "Entertainment", languageCode: "gu" },
  { sourceName: "Divya Bhaskar - Lifestyle", rssUrl: "https://www.divyabhaskar.co.in/rss-v1--category-5029.xml", language: "Gujarati", category: "જીવનશૈલી", englishName: "Lifestyle", languageCode: "gu" },
  { sourceName: "Divya Bhaskar - Business", rssUrl: "https://www.divyabhaskar.co.in/rss-v1--category-969.xml", language: "Gujarati", category: "વ્યવસાય", englishName: "Business", languageCode: "gu" },
  { sourceName: "Divya Bhaskar - Sports", rssUrl: "https://www.divyabhaskar.co.in/rss-v1--category-970.xml", language: "Gujarati", category: "રમતગમત", englishName: "Sports", languageCode: "gu" }
];

async function seedMasterPrompt() {
  await connectDB();
  logger.info('Seeding All Master Sources (English & Hindi) to MongoDB Atlas...');
  
  try {
    for (const source of allSources) {
      // 1. Ensure Language exists
      await Language.updateOne(
        { name: source.language },
        { $setOnInsert: { name: source.language, code: source.languageCode, enabled: true } },
        { upsert: true }
      );

      // 2. Ensure Category exists with English mapping
      await Category.updateOne(
        { language: source.language, name: source.category },
        { 
          $set: { englishName: source.englishName, enabled: true },
          $setOnInsert: { language: source.language, name: source.category }
        },
        { upsert: true }
      );

      // 3. Add RSS Source
      await RssSource.updateOne(
        { rssUrl: source.rssUrl },
        { 
          $set: { 
            sourceName: source.sourceName,
            language: source.language,
            category: source.category,
            priority: 10,
            enabled: true
          }
        },
        { upsert: true }
      );
    }
    
    logger.info(`✓ Successfully seeded exactly ${allSources.length} sources (English + Hindi) into MongoDB!`);
    process.exit(0);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to seed sources');
    process.exit(1);
  }
}

seedMasterPrompt();
