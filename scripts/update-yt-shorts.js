const https = require('https');
const fs = require('fs');
const channelId = 'UCGfUe5ljqW9n2ZsSLXgcbPA';
const url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId;

// Category list (order matters for chip display)
const categories = [
  'Nội thất',
  'Bếp & Thiết bị F&B',
  'Máy kinh doanh',
  'Thiết bị Gym',
  'Ngoài trời & Sân vườn',
  'Decor & Cảm hứng',
  'Đóng gói & Logistics'
];

// Keyword → category mapping for auto-guessing new videos
const categoryKeywords = {
  'Nội thất': ['sofa','giường','tủ','bàn','ghế','nội thất','lễ tân','quầy','morigaya','bàn ăn','ban an','phòng tắm','phong tam','shangri-la','vai cao','mới về','moi ve'],
  'Bếp & Thiết bị F&B': ['gelato','bếp','nhà hàng','f&b','ẩm thực','tiệm','trà','sảnh đến bếp'],
  'Máy kinh doanh': ['máy in 3d','máy in','công nghiệp','thiết bị','dây chuyền','sản xuất','máy'],
  'Thiết bị Gym': ['gym','smith machine','tập','thể thao','fitness','tủ tập'],
  'Ngoài trời & Sân vườn': ['ngoài trời','sân vườn','hoa','hộp hoa','inox','outdoor','bền bỉ ngoài trời'],
  'Decor & Cảm hứng': ['decor','trang trí','cảm hứng','không gian sống'],
  'Đóng gói & Logistics': ['đóng gói','logistics','vận chuyển','giao hàng','giao tận','white glove logistic']
};

function guessCategory(title) {
  const lower = title.toLowerCase();
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) return cat;
  }
  return null;
}

// Load existing JSON to preserve category assignments for known videos
let existingMap = {};
try {
  const old = JSON.parse(fs.readFileSync('content/yt-shorts.json', 'utf8'));
  if (old.shorts) old.shorts.forEach(s => { existingMap[s.id] = s; });
} catch (e) { /* file may not exist yet */ }

https.get(url, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const entries = [];
    const re = /<entry>[\s\S]*?<\/entry>/g;
    let m;
    while ((m = re.exec(data)) !== null) {
      const e = m[0];
      const vid = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const title = e.match(/<title>([^<]+)<\/title>/);
      const pub = e.match(/<published>([^<]+)<\/published>/);
      if (vid && title) {
        const id = vid[1];
        const existing = existingMap[id];
        // Preserve existing category if present, otherwise guess from title
        const category = existing && existing.category !== undefined ? existing.category : guessCategory(title[1]);
        entries.push({ id, type: 'youtube', title: title[1], category, published: pub ? pub[1] : '' });
      }
    }
    const json = JSON.stringify({ channel: channelId, updated: new Date().toISOString(), count: entries.length, categories, shorts: entries }, null, 2);
    fs.writeFileSync('content/yt-shorts.json', json);
    console.log('Updated ' + entries.length + ' shorts with ' + categories.length + ' categories');
  });
}).on('error', err => {
  console.error('Failed to fetch RSS:', err);
  process.exit(1);
});
