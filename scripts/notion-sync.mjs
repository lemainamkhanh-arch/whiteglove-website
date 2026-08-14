// scripts/notion-sync.mjs — Notion (source of truth) -> site publisher
// Publishes rows with status "Đã duyệt" from the SEO Content Plan DB, then marks them "Đã publish".
import fs from 'node:fs';

const KEY = process.env.NOTION_API_KEY;
if (!KEY) { console.error('Missing NOTION_API_KEY'); process.exit(1); }
const API = 'https://api.notion.com/v1';
const HEADERS = { 'Authorization': 'Bearer ' + KEY, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
const SITE = 'https://whiteglove.vn';

const P_TITLE = 'Từ khóa / Chủ đề bài viết';
const P_STATUS = 'Trạng thái';
const P_SLUG = 'Slug (/blog/...)';
const P_DESC = 'Meta description';
const P_LINK = 'Link bài trên site';
const P_DATE = 'Ngày đăng';
const ST_APPROVED = 'Đã duyệt';
const ST_PUBLISHED = 'Đã publish';

async function api(path, method = 'GET', body) {
  const res = await fetch(API + path, { method, headers: HEADERS, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(method + ' ' + path + ' -> HTTP ' + res.status + ': ' + await res.text());
  return res.json();
}

const plain = arr => (arr || []).map(t => t.plain_text || '').join('');
const rt = arr => (arr || []).map(t => {
  let s = t.plain_text || '';
  const a = t.annotations || {};
  if (a.code) s = '`' + s + '`';
  if (a.bold) s = '**' + s + '**';
  else if (a.italic) s = '*' + s + '*';
  if (t.href) s = '[' + s + '](' + t.href + ')';
  return s;
}).join('');

const slugify = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

async function downloadImage(url, slug, idx) {
  try {
    const res = await fetch(url);
    if (!res.ok) { console.log('IMG HTTP ' + res.status + ' (' + slug + '-' + idx + ')'); return null; }
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    let ext = '';
    const clean = url.split('?')[0].toLowerCase();
    const dot = clean.lastIndexOf('.');
    if (dot !== -1) { const cand = clean.slice(dot + 1); if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg'].includes(cand)) ext = cand; }
    if (!ext) ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : ct.includes('svg') ? 'svg' : ct.includes('avif') ? 'avif' : (ct.includes('jpeg') || ct.includes('jpg')) ? 'jpg' : 'png';
    if (ext === 'jpeg') ext = 'jpg';
    fs.mkdirSync('assets/blog', { recursive: true });
    const rel = 'assets/blog/' + slug + '-' + idx + '.' + ext;
    fs.writeFileSync(rel, buf);
    return '/' + rel;
  } catch (e) { console.log('IMG download failed (' + slug + '-' + idx + '): ' + e.message); return null; }
}

async function blocksToMarkdown(blockId, slug) {
  const lines = [];
  let cursor, prevList = false, imgIdx = 0;
  do {
    const data = await api('/blocks/' + blockId + '/children?page_size=100' + (cursor ? '&start_cursor=' + cursor : ''));
    for (const b of data.results) {
      const t = b.type, v = b[t];
      const isList = t === 'bulleted_list_item' || t === 'numbered_list_item' || t === 'to_do';
      if (prevList && !isList) lines.push('');
      if (t === 'paragraph') { const s = rt(v.rich_text); if (s.trim()) { lines.push(s); lines.push(''); } }
      else if (t === 'heading_1' || t === 'heading_2') { lines.push('## ' + plain(v.rich_text)); lines.push(''); }
      else if (t === 'heading_3') { lines.push('### ' + plain(v.rich_text)); lines.push(''); }
      else if (isList) { lines.push('- ' + rt(v.rich_text)); }
      else if (t === 'quote' || t === 'callout') { lines.push('> ' + rt(v.rich_text)); lines.push(''); }
      else if (t === 'image') { const u = v.type === 'external' ? v.external.url : (v.file || {}).url; if (u) { imgIdx++; const local = slug ? await downloadImage(u, slug, imgIdx) : null; lines.push('![' + plain(v.caption) + '](' + (local || u) + ')'); lines.push(''); } }
      else if (t === 'embed') { const u = v.url || ''; if (/youtube\.com|youtu\.be/i.test(u)) { lines.push('[[YOUTUBE:' + u + '|Video YouTube]]'); lines.push(''); } }
      prevList = isList;
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

async function main() {
  const found = await api('/search', 'POST', { query: 'SEO Content Plan', filter: { value: 'database', property: 'object' } });
  const db = (found.results || []).find(d => plain(d.title).includes('SEO Content Plan'));
  if (!db) { console.log('SEO Content Plan database is not shared with this integration yet — nothing to sync.'); return; }

  const rows = [];
  let cursor;
  do {
    const q = await api('/databases/' + db.id + '/query', 'POST', cursor ? { page_size: 100, start_cursor: cursor } : { page_size: 100 });
    rows.push(...q.results);
    cursor = q.has_more ? q.next_cursor : null;
  } while (cursor);

  const titleOf = p => plain(((p.properties[P_TITLE] || {}).title));
  const statusOf = p => (((p.properties[P_STATUS] || {}).status) || {}).name || '';
  const textOf = (p, n) => plain(((p.properties[n] || {}).rich_text));
  const urlOf = p => (p.properties[P_LINK] || {}).url || '';

  const today = new Date().toISOString().slice(0, 10);
  let published = 0;

  for (const page of rows.filter(p => statusOf(p) === ST_APPROVED)) {
    const title = titleOf(page);
    const slug = (textOf(page, P_SLUG).replace(/^\/?(blog\/)?/, '').replace(/\//g, '').trim()) || slugify(title);
    let body;
    try { body = await blocksToMarkdown(page.id, slug); }
    catch (e) { console.log('SKIP "' + title + '": cannot read page body — ' + e.message); continue; }
    if (body.trim().length < 200) { console.log('SKIP "' + title + '": page body qua ngan — hay viet noi dung day du trong Notion truoc.'); continue; }
    const desc = textOf(page, P_DESC).trim() || body.replace(/[#>*`!\[\]()-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 155);
    const q = s => '"' + s.replace(/"/g, "'") + '"';
    const md = ['---', 'title: ' + q(title), 'description: ' + q(desc), 'slug: ' + slug, 'date: ' + today, 'keyword: ' + q(title.toLowerCase()), 'draft: false', '---', '', body].join('\n');
    fs.mkdirSync('content/blog', { recursive: true });
    fs.writeFileSync('content/blog/' + slug + '.md', md);
    const link = SITE + '/blog/' + slug + '/';
    await api('/pages/' + page.id, 'PATCH', { properties: {
      [P_STATUS]: { status: { name: ST_PUBLISHED } },
      [P_LINK]: { url: link },
      [P_DATE]: { date: { start: today } },
      [P_SLUG]: { rich_text: [{ text: { content: slug } }] },
    }});
    console.log('PUBLISHED: ' + slug);
    published++;
  }

  // Plan overview (visible in CMS as read-only list of all titles + statuses)
  const order = ['Ý tưởng', 'Đã chốt keyword', 'Richard đang viết', 'Chờ duyệt', 'Cần sửa', 'Đã duyệt', 'Đã publish'];
  const out = ['---', 'title: "Kế hoạch content từ Notion"', 'updated: "' + new Date().toISOString() + '"', '---', '', '> File này được tạo tự động từ database SEO Content Plan trên Notion. Muốn đổi kế hoạch hay publish bài, thao tác trong Notion: đổi Trạng thái sang **Đã duyệt** là bài tự lên site.', ''];
  for (const st of order) {
    const group = rows.filter(r => statusOf(r) === st);
    if (!group.length) continue;
    out.push('## ' + st + ' (' + group.length + ')', '');
    for (const r of group) {
      const link = statusOf(r) === ST_PUBLISHED && urlOf(r) ? ' — [' + urlOf(r) + '](' + urlOf(r) + ')' : '';
      out.push('- ' + titleOf(r) + link);
    }
    out.push('');
  }
  fs.writeFileSync('content/notion-plan.md', out.join('\n'));
  console.log('Done: ' + published + ' post(s) published, ' + rows.length + ' rows in plan overview.');
}

main().catch(e => { console.error(e); process.exit(1); });
