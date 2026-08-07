const https = require('https');
const fs = require('fs');
const channelId = 'UCGfUe5ljqW9n2ZsSLXgcbPA';
const url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId;
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
      if (vid && title) entries.push({ id: vid[1], title: title[1], published: pub ? pub[1] : '' });
    }
    const json = JSON.stringify({ channel: channelId, updated: new Date().toISOString(), count: entries.length, shorts: entries }, null, 2);
    fs.writeFileSync('content/yt-shorts.json', json);
    console.log('Updated ' + entries.length + ' shorts');
  });
}).on('error', err => {
  console.error('Failed to fetch RSS:', err);
  process.exit(1);
});
