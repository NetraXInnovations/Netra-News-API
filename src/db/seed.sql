-- Seed Data for Netra News Hub

-- 1. Populating languages
INSERT INTO languages (id, name, code, enabled) VALUES
(1, 'English', 'en', true),
(2, 'Hindi', 'hi', true),
(3, 'Telugu', 'te', true),
(4, 'Tamil', 'ta', true),
(5, 'Bengali', 'bn', true)
ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled;

-- Reset serial sequences for languages
SELECT setval('languages_id_seq', 5);

-- 2. Populating categories
INSERT INTO categories (id, language_id, name, enabled) VALUES
-- English Categories (id: 1 - 16)
(1, 1, 'India', true),
(2, 1, 'World', true),
(3, 1, 'States', true),
(4, 1, 'Sports', true),
(5, 1, 'Cricket', true),
(6, 1, 'Technology', true),
(7, 1, 'Business', true),
(8, 1, 'Health', true),
(9, 1, 'Entertainment', true),
(10, 1, 'Science', true),
(11, 1, 'Education', true),
(12, 1, 'Economy', true),
(13, 1, 'Politics', true),
(14, 1, 'Lifestyle', true),
(15, 1, 'People', true),
(16, 1, 'Arts & Culture', true),

-- Hindi Categories (id: 17 - 28)
(17, 2, 'भारत', true),
(18, 2, 'दुनिया', true),
(19, 2, 'राज्य', true),
(20, 2, 'खेल', true),
(21, 2, 'क्रिकेट', true),
(22, 2, 'टेक्नोलॉजी', true),
(23, 2, 'बिज़नेस', true),
(24, 2, 'सेहत', true),
(25, 2, 'मनोरंजन', true),
(26, 2, 'विज्ञान', true),
(27, 2, 'शिक्षा', true),
(28, 2, 'लाइफ़स्टाइल', true),

-- Telugu Categories (id: 29 - 41)
(29, 3, 'ఆంధ్రప్రదేశ్', true),
(30, 3, 'తెలంగాణ', true),
(31, 3, 'భారతదేశం', true),
(32, 3, 'ప్రపంచం', true),
(33, 3, 'క్రీడలు', true),
(34, 3, 'క్రికెట్', true),
(35, 3, 'సాంకేతికత', true),
(36, 3, 'వ్యాపారం', true),
(37, 3, 'ఆరోగ్యం', true),
(38, 3, 'వినోదం', true),
(39, 3, 'విజ్ఞానశాస్త్రం', true),
(40, 3, 'రాజకీయాలు', true),
(41, 3, 'జీవనశైలి', true),

-- Tamil Categories (id: 42 - 54)
(42, 4, 'தமிழ்நாடு', true),
(43, 4, 'இந்தியா', true),
(44, 4, 'உலகம்', true),
(45, 4, 'வாழ்க்கை முறை', true),
(46, 4, 'கல்வி', true),
(47, 4, 'விளையாட்டு', true),
(48, 4, 'கிரிக்கெட்', true),
(49, 4, 'தொழில்நுட்பம்', true),
(50, 4, 'வணிகம்', true),
(51, 4, 'சுகாதாரம்', true),
(52, 4, 'பொழுதுபோக்கு', true),
(53, 4, 'அறிவியல்', true),
(54, 4, 'வாகனங்கள்', true),

-- Bengali Categories (id: 55 - 65)
(55, 5, 'পশ্চিমবঙ্গ', true),
(56, 5, 'ভারত', true),
(57, 5, 'বিশ্ব', true),
(58, 5, 'রাজনীতি', true),
(59, 5, 'ব্যবসা', true),
(60, 5, 'প্রযুক্তি', true),
(61, 5, 'স্বাস্থ্য', true),
(62, 5, 'খেলা', true),
(63, 5, 'ক্রিকেট', true),
(64, 5, 'বিনোদন', true),
(65, 5, 'শিক্ষা', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled;

-- Reset serial sequences for categories
SELECT setval('categories_id_seq', 65);

-- 3. Populating RSS Sources
INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
-- English RSS Feeds
(1, 1, 'The Hindu - National', 'https://www.thehindu.com/news/national/feeder/default.rss', true, 1),
(1, 2, 'The Hindu - International', 'https://www.thehindu.com/news/international/feeder/default.rss', true, 1),
(1, 3, 'India Today - States', 'https://www.indiatoday.in/rss/1206500', true, 1),
(1, 4, 'India Today - Sports', 'https://www.indiatoday.in/rss/1206550', true, 1),
(1, 5, 'Times of India - Cricket', 'https://timesofindia.indiatimes.com/rssfeeds/54829575.cms', true, 1),
(1, 6, 'Times of India - Technology', 'https://timesofindia.indiatimes.com/rssfeeds/66949542.cms', true, 1),
(1, 7, 'Times of India - Business', 'https://timesofindia.indiatimes.com/rssfeeds/1898055.cms', true, 1),
(1, 8, 'NDTV Cooks - Health', 'https://feeds.feedburner.com/ndtvcooks-latest', true, 1),
(1, 10, 'Times of India - Science', 'https://timesofindia.indiatimes.com/rssfeeds/-2128672765.cms', true, 1),
(1, 11, 'Times of India - Education', 'https://timesofindia.indiatimes.com/rssfeeds/913168846.cms', true, 1),
(1, 12, 'Frontline - Economy', 'https://frontline.thehindu.com/economy/feeder/default.rss', true, 1),
(1, 13, 'News18 - Politics', 'https://www.news18.com/commonfeeds/v1/eng/rss/politics.xml', true, 1),
(1, 14, 'Times of India - Lifestyle', 'https://timesofindia.indiatimes.com/rssfeeds/2886704.cms', true, 1),
(1, 15, 'NDTV News - People', 'https://feeds.feedburner.com/ndtvnews-people', true, 1),
(1, 16, 'Frontline - Arts & Culture', 'https://frontline.thehindu.com/arts-and-culture/feeder/default.rss', true, 1),

-- Hindi RSS Feeds
(2, 17, 'Dainik Bhaskar - India', 'https://www.bhaskar.com/rss-v1--category-1061.xml', true, 1),
(2, 18, 'Dainik Bhaskar - World', 'https://www.bhaskar.com/rss-v1--category-1125.xml', true, 1),
(2, 19, 'News18 Hindi - States', 'https://hindi.news18.com/commonfeeds/v1/hin/rss/states.xml', true, 1),
(2, 20, 'Dainik Bhaskar - Sports', 'https://www.bhaskar.com/rss-v1--category-1053.xml', true, 1),
(2, 21, 'News18 Hindi - Cricket', 'https://hindi.news18.com/commonfeeds/v1/hin/rss/sports/cricket.xml', true, 1),
(2, 22, 'Dainik Bhaskar - Technology', 'https://www.bhaskar.com/rss-v1--category-5707.xml', true, 1),
(2, 23, 'Dainik Bhaskar - Business', 'https://www.bhaskar.com/rss-v1--category-1051.xml', true, 1),
(2, 24, 'News18 Hindi - Health', 'https://hindi.news18.com/commonfeeds/v1/hin/rss/lifestyle/health.xml', true, 1),
(2, 25, 'Dainik Bhaskar - Entertainment', 'https://www.bhaskar.com/rss-v1--category-3998.xml', true, 1),
(2, 26, 'Gadgets360 - Science', 'https://hindi.gadgets360.com/rss/science/news', true, 1),
(2, 27, 'India TV - Education', 'https://www.indiatv.in/rssnews/topstory-education.xml', true, 1),
(2, 28, 'India TV - Lifestyle', 'https://www.indiatv.in/rssnews/topstory-lifestyle.xml', true, 1),

-- Telugu RSS Feeds
(3, 29, 'News18 Telugu - Andhra Pradesh', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/andhra-pradesh.xml', true, 1),
(3, 30, 'News18 Telugu - Telangana', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/telangana.xml', true, 1),
(3, 31, 'News18 Telugu - India', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/national.xml', true, 1),
(3, 32, 'News18 Telugu - World', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/international.xml', true, 1),
(3, 33, 'News18 Telugu - Sports', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/sports.xml', true, 1),
(3, 34, 'News18 Telugu - Cricket', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/cricket.xml', true, 1),
(3, 35, 'News18 Telugu - Technology', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/technology.xml', true, 1),
(3, 36, 'News18 Telugu - Business', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/business.xml', true, 1),
(3, 37, 'News18 Telugu - Health', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/life-style/health.xml', true, 1),
(3, 38, 'OneIndia Telugu - Entertainment', 'https://telugu.oneindia.com/rss/feeds/telugu-entertainment-fb.xml', true, 1),
(3, 39, 'News18 Telugu - Science', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/science.xml', true, 1),
(3, 40, 'News18 Telugu - Politics', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/national/politics-national.xml', true, 1),
(3, 41, 'News18 Telugu - Lifestyle', 'https://telugu.news18.com/commonfeeds/v1/tel/rss/life-style.xml', true, 1),

-- Tamil RSS Feeds
(4, 42, 'News18 Tamil - Tamil Nadu', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/tamil-nadu.xml', true, 1),
(4, 43, 'Vikatan - India', 'https://www.vikatan.com/api/v1/collections/india-news.rss', true, 1),
(4, 44, 'Vikatan - World', 'https://www.vikatan.com/api/v1/collections/international.rss', true, 1),
(4, 45, 'News18 Tamil - Lifestyle', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/lifestyle.xml', true, 1),
(4, 46, 'News18 Tamil - Education', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/education.xml', true, 1),
(4, 47, 'News18 Tamil - Sports', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/sports.xml', true, 1),
(4, 48, 'News18 Tamil - Cricket', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/sports/cricket.xml', true, 1),
(4, 49, 'Vikatan - Technology', 'https://www.vikatan.com/stories.rss?section-id=8968', true, 1),
(4, 50, 'News18 Tamil - Business', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/business.xml', true, 1),
(4, 51, 'Vikatan - Health', 'https://www.vikatan.com/stories.rss?section-id=8963', true, 1),
(4, 52, 'Vikatan - Entertainment', 'https://www.vikatan.com/stories.rss?section-id=8956', true, 1),
(4, 53, 'Vikatan - Science', 'https://www.vikatan.com/stories.rss?section-id=8965', true, 1),
(4, 54, 'News18 Tamil - Automobile', 'https://tamil.news18.com/commonfeeds/v1/tam/rss/automobile.xml', true, 1),

-- Bengali RSS Feeds
(5, 55, 'OneIndia Bengali - West Bengal', 'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml', true, 1),
(5, 55, 'Anandabazar - State', 'https://www.anandabazar.com/rss/state.xml', true, 1),
(5, 56, 'OneIndia Bengali - India', 'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml?cat=india', true, 1),
(5, 56, 'Anandabazar - India', 'https://www.anandabazar.com/rss/india.xml', true, 1),
(5, 57, 'OneIndia Bengali - World', 'https://bengali.oneindia.com/rss/feeds/bengali-news-world-fb.xml', true, 1),
(5, 57, 'Anandabazar - International', 'https://www.anandabazar.com/rss/international.xml', true, 1),
(5, 58, 'Anandabazar - Politics', 'https://www.anandabazar.com/rss/politics.xml', true, 1),
(5, 58, 'OneIndia Bengali - Politics', 'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml?cat=politics', true, 1),
(5, 59, 'Anandabazar - Business', 'https://www.anandabazar.com/rss/business.xml', true, 1),
(5, 59, 'OneIndia Bengali - Business', 'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml?cat=business', true, 1),
(5, 60, 'OneIndia Bengali - Technology', 'https://bengali.oneindia.com/rss/feeds/bengali-gadgets-fb.xml', true, 1),
(5, 60, 'Anandabazar - Science & Tech', 'https://www.anandabazar.com/rss/science.xml', true, 1),
(5, 61, 'OneIndia Bengali - Health', 'https://bengali.oneindia.com/rss/feeds/bengali-lifestyle-fb.xml', true, 1),
(5, 61, 'Anandabazar - Lifestyle', 'https://www.anandabazar.com/rss/lifestyle.xml', true, 1),
(5, 62, 'OneIndia Bengali - Sports', 'https://bengali.oneindia.com/rss/feeds/bengali-sports-fb.xml', true, 1),
(5, 62, 'Anandabazar - Sports', 'https://www.anandabazar.com/rss/sports.xml', true, 1),
(5, 63, 'OneIndia Bengali - Cricket', 'https://bengali.oneindia.com/rss/feeds/bengali-sports-cricket-fb.xml', true, 1),
(5, 63, 'Anandabazar - Cricket', 'https://www.anandabazar.com/rss/cricket.xml', true, 1),
(5, 64, 'OneIndia Bengali - Entertainment', 'https://bengali.oneindia.com/rss/feeds/bengali-entertainment-fb.xml', true, 1),
(5, 64, 'Anandabazar - Entertainment', 'https://www.anandabazar.com/rss/entertainment.xml', true, 1),
(5, 65, 'OneIndia Bengali - Education', 'https://bengali.oneindia.com/rss/feeds/bengali-education-fb.xml', true, 1),
(5, 65, 'Anandabazar - Education', 'https://www.anandabazar.com/rss/career-and-education.xml', true, 1)
ON CONFLICT (rss_url) DO NOTHING;
