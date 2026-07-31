const fs = require('fs');
const path = require('path');

const SITE = 'https://whiteglove.vn';

// 1) Homepage: inject content into template
const template = fs.readFileSync('template.html', 'utf8');
const content = JSON.parse(fs.readFileSync('content/site.json', 'utf8'));
let html = template;
for (const [key, value] of Object.entries(content)) {
  html = html.split('@@' + key + '@@').join(value);
}
fs.writeFileSync('index.html', html);

// 2) Blog: markdown posts -> static pages
function parseFrontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = {};
  let body = src;
  if (m) {
    body = src.slice(m[0].length);
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) { let v = line.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); meta[line.slice(0, i).trim()] = v; }
    }
  }
  return { meta, body };
}
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function inline(s) {
  return s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
function mdToHtml(md) {
  const out = [];
  let inList = false, para = [];
  const flush = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (/^###\s/.test(line)) { flush(); closeList(); out.push('<h3>' + inline(line.slice(4)) + '</h3>'); }
    else if (/^##\s/.test(line)) { flush(); closeList(); out.push('<h2>' + inline(line.slice(3)) + '</h2>'); }
    else if (/^-\s/.test(line)) { flush(); if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inline(line.slice(2)) + '</li>'); }
    else if (/^>\s?/.test(line)) { flush(); closeList(); out.push('<blockquote>' + inline(line.replace(/^>\s?/, '')) + '</blockquote>'); }
    else if (line === '') { flush(); closeList(); }
    else para.push(line);
  }
  flush(); closeList();
  return out.join('\n');
}
function fill(tpl, vars) {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split('%%' + k + '%%').join(v);
  return out;
}

const postTpl = fs.readFileSync('templates/post.html', 'utf8');
const blogTpl = fs.readFileSync('templates/blog.html', 'utf8');
const blogSrc = 'content/blog';
const posts = [];
if (fs.existsSync(blogSrc)) {
  for (const f of fs.readdirSync(blogSrc).filter((x) => x.endsWith('.md'))) {
    const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(blogSrc, f), 'utf8'));
    if (!meta.slug || meta.draft === 'true') continue;
    posts.push({ ...meta, bodyHtml: mdToHtml(body) });
  }
}
posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

fs.rmSync('blog', { recursive: true, force: true });
fs.mkdirSync('blog', { recursive: true });
for (const p of posts) {
  const dir = path.join('blog', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), fill(postTpl, {
    TITLE: esc(p.title || ''),
    DESCRIPTION: esc(p.description || ''),
    DATE: p.date || '',
    DATE_HUMAN: (p.date || '').split('-').reverse().join('/'),
    URL: SITE + '/blog/' + p.slug + '/',
    BODY: p.bodyHtml,
  }));
}
const items = posts.map((p) =>
  '<li><a href="/blog/' + p.slug + '/"><span class="d">' + (p.date || '').split('-').reverse().join('/') +
  '</span><span class="t">' + esc(p.title || '') + '</span><span class="s">' + esc(p.description || '') + '</span></a></li>'
).join('\n');
fs.writeFileSync('blog/index.html', fill(blogTpl, { ITEMS: items || '<li>Bài viết đang được cập nhật…</li>' }));

// 3) sitemap.xml
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: SITE + '/', lastmod: today, priority: '1.0' },
  { loc: SITE + '/blog/', lastmod: today, priority: '0.6' },
  ...posts.map((p) => ({ loc: SITE + '/blog/' + p.slug + '/', lastmod: p.date || today, priority: '0.7' })),
];
fs.writeFileSync('sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => '  <url><loc>' + u.loc + '</loc><lastmod>' + u.lastmod + '</lastmod><priority>' + u.priority + '</priority></url>').join('\n') +
  '\n</urlset>\n');

console.log('Built: index.html, ' + posts.length + ' blog post(s), blog/index.html, sitemap.xml');
