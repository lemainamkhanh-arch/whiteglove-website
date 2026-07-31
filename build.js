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

// Site settings (contact info) — optional file managed via CMS "Cài đặt chung"
let settingsContactHtml = '';
if (fs.existsSync('content/settings.json')) {
  try {
    const settings = JSON.parse(fs.readFileSync('content/settings.json', 'utf8'));
    const parts = [];
    if (settings.hotline) parts.push('<a href="tel:' + settings.hotline.replace(/[^0-9+]/g, '') + '">' + settings.hotline + '</a>');
    if (settings.email) parts.push('<a href="mailto:' + settings.email + '">' + settings.email + '</a>');
    if (settings.address) parts.push('<span style="display:block;color:rgba(255,255,255,.58);font-size:.86rem;margin:9px 0">' + settings.address + '</span>');
    if (settings.workingHours) parts.push('<span style="display:block;color:rgba(255,255,255,.58);font-size:.86rem;margin:9px 0">' + settings.workingHours + '</span>');
    if (settings.facebook) parts.push('<a href="' + settings.facebook + '" target="_blank" rel="noopener">Facebook</a>');
    if (settings.zalo) parts.push('<a href="' + settings.zalo + '" target="_blank" rel="noopener">Zalo</a>');
    settingsContactHtml = parts.join('');
  } catch (e) { settingsContactHtml = ''; }
}
html = html.split('@@SETTINGS_CONTACT@@').join(settingsContactHtml);

fs.writeFileSync('index.html', html);

// Extract the shared header (announcement bar + nav) from the built homepage
// so blog/post pages always show the exact same header as the homepage.
const navMatch = html.match(/<div class="topline">[\s\S]*?<\/nav>/);
let subHeader = '';
if (navMatch) {
  subHeader = navMatch[0]
    .split('href="#').join('href="/#')
    .split('<a href="/blog/">Blog</a>').join('<a href="/blog/" style="color:var(--blue)" aria-current="page">Blog</a>');
  subHeader += '<script>(function(){var m=document.querySelector(".menu"),l=document.querySelector(".navlinks");if(!m||!l)return;m.addEventListener("click",function(){var o=l.classList.toggle("open");m.setAttribute("aria-expanded",o)});l.querySelectorAll("a").forEach(function(a){a.addEventListener("click",function(){l.classList.remove("open")})});})();</script>';
}


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
function extractSection(body, headingRegex) {
  const lines = body.split('\n');
  let start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (start === -1 && headingRegex.test(lines[i])) { start = i + 1; continue; }
    if (start !== -1 && /^##\s/.test(lines[i])) { end = i; break; }
  }
  if (start === -1) return null;
  return lines.slice(start, end).join('\n');
}
function extractFaq(body) {
  const section = extractSection(body, /^##\s*C\u00e2u h\u1ecfi th\u01b0\u1eddng g\u1eb7p/i);
  if (!section) return [];
  const faqs = [];
  const lines = section.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    let q = null;
    const h3 = line.match(/^###\s+(.+)$/);
    const bold = line.match(/^\*\*(.+)\*\*$/);
    if (h3) q = h3[1].trim();
    else if (bold) q = bold[1].trim();
    if (q) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      const ansLines = [];
      while (j < lines.length && lines[j].trim() !== '') { ansLines.push(lines[j].trim()); j++; }
      if (ansLines.length) faqs.push({ q, a: ansLines.join(' ') });
      i = j;
    } else { i++; }
  }
  return faqs;
}
function extractHowTo(body, name) {
  const section = extractSection(body, /^##\s*Quy tr\u00ecnh/i);
  if (!section) return null;
  const stepRe = /^-\s+\*\*B\u01b0\u1edbc\s*\d+(?:\s*[\u2014-]\s*(.+?))?\*\*:\s*(.+)$/;
  const steps = [];
  for (const raw of section.split('\n')) {
    const line = raw.trim();
    const m = line.match(stepRe);
    if (m) {
      const title = (m[1] || '').trim();
      const text = m[2].trim();
      steps.push({ name: title || text.split(/[.,;\u2014]/)[0].slice(0, 60).trim(), text });
    }
  }
  if (steps.length < 2) return null;
  return { name, steps };
}
function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
function styleFaqSection(html) {
  const heading = '<h2>C\u00e2u h\u1ecfi th\u01b0\u1eddng g\u1eb7p</h2>\n';
  const idx = html.indexOf(heading);
  if (idx === -1) return html;
  let pos = idx + heading.length;
  const itemRe = /^<h3>([\s\S]*?)<\/h3>\n<p>([\s\S]*?)<\/p>\n?/;
  const items = [];
  while (true) {
    const rest = html.slice(pos);
    const m = rest.match(itemRe);
    if (!m) break;
    items.push({ q: m[1], a: m[2] });
    pos += m[0].length;
  }
  if (!items.length) return html;
  const wrapped = '<div class="faq-list">\n' + items.map((it) => '<div class="faq-item">\n<h3>' + it.q + '</h3>\n<p>' + it.a + '</p>\n</div>').join('\n') + '\n</div>\n';
  return html.slice(0, idx + heading.length) + wrapped + html.slice(pos);
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
    posts.push({ ...meta, bodyHtml: styleFaqSection(mdToHtml(body)), rawBody: body });
  }
}
posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

fs.rmSync('blog', { recursive: true, force: true });
fs.mkdirSync('blog', { recursive: true });
for (const p of posts) {
  const dir = path.join('blog', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  let extraSchema = '';
  const faqs = extractFaq(p.rawBody || '');
  if (faqs.length) {
    extraSchema += '<script type="application/ld+json">' + jsonLd({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    }) + '</script>\n';
  }
  const howto = extractHowTo(p.rawBody || '', p.title || '');
  if (howto) {
    extraSchema += '<script type="application/ld+json">' + jsonLd({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: howto.name,
      step: howto.steps.map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
    }) + '</script>\n';
  }
  fs.writeFileSync(path.join(dir, 'index.html'), fill(postTpl, {
    HEADER: subHeader,
    TITLE: esc(p.title || ''),
    DESCRIPTION: esc(p.description || ''),
    DATE: p.date || '',
    DATE_HUMAN: (p.date || '').split('-').reverse().join('/'),
    URL: SITE + '/blog/' + p.slug + '/',
    BODY: p.bodyHtml,
    EXTRA_SCHEMA: extraSchema,
  }));
}
const items = posts.map((p) => {
  const im = (p.rawBody || '').match(/!\[[^\]]*\]\(([^)]+)\)/);
  const thumb = im ? '<span class="th"><img src="' + im[1] + '" alt="" loading="lazy"></span>' : '';
  return '<li><a href="/blog/' + p.slug + '/">' + thumb + '<span class="tx"><span class="d">' + (p.date || '').split('-').reverse().join('/') +
  '</span><span class="t">' + esc(p.title || '') + '</span><span class="s">' + esc(p.description || '') + '</span></span></a></li>';
}
).join('\n');
fs.writeFileSync('blog/index.html', fill(blogTpl, { HEADER: subHeader, ITEMS: items || '<li>Bài viết đang được cập nhật…</li>' }));

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
