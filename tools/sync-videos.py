#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sync videos for the sourcing page.

Source of truth: Notion 'Video Maketing' DB (categories curated there).
This script merges DB-classified videos with the latest YouTube channel
uploads (RSS) and writes content/yt-shorts.json.

Run: python3 tools/sync-videos.py
When the Notion DB changes, update DB_VIDEOS below (or ask the agent).
"""
import json, re, urllib.request, xml.etree.ElementTree as ET

# --- Videos classified in the Notion DB (31 embeddable) ---
# (yt_id_or_mp4_url, type, category, title)
DB_VIDEOS = [
 ('yRdZK-RiLug','youtube','Nội thất','Lò sưởi đá travertine nguyên khối'),
 ('flStYuDJXBA','youtube','Nội thất','Lò sưởi travertine tối giản'),
 ('bIchg6pED7s','youtube','Máy kinh doanh','Máy chụp ảnh sticker tự động'),
 ('0JjQKUHikKw','youtube','Decor & Cảm hứng','Decor vintage hoài cổ Nam Dương'),
 ('h_tmeQG93Ng','youtube','Nội thất','Sofa module Horizon linh hoạt'),
 ('jXFD_totJbk','youtube','Decor & Cảm hứng','Decor tự nhiên thư thái'),
 ('uycbTAr9NEs','youtube','Nội thất','Ghế ăn 451 — thiết kế mới'),
 ('tDDG3rK6BGw','youtube','Decor & Cảm hứng','Không gian nghệ thuật tối giản'),
 ('4ifH2lDufpc','youtube','Bếp & Thiết bị F&B','Tủ lạnh Gaggenau dung tích lớn'),
 ('jR_7a70-HhU','youtube','Nội thất','Hệ kệ lưu trữ module 606'),
 ('7-fWXRvwI8A','youtube','Máy kinh doanh','Photo booth tương tác'),
 ('cEtX4yodtiM','youtube','Nội thất','Tủ rượu hải sâm 1.78m'),
 ('1QchDoT5xgQ','youtube','Nội thất','Bàn ăn đá Carrara trắng'),
 ('jX9o0p_RIxY','youtube','Thiết bị Gym','Thiết bị gym Salusia J01'),
 ('OacIP7Ojq7U','youtube','Nội thất','Bàn làm việc cong nhỏ gọn'),
 ('2SkK0Va6BKM','youtube','Bếp & Thiết bị F&B','Bếp biệt thự: bếp ga + hút mùi lực mạnh'),
 ('nOKg-jVmp3o','youtube','Máy kinh doanh','Photo booth tự vận hành'),
 ('GhN62HVhFz8','youtube','Nội thất','Bàn tròn gấp Bauhaus 1970'),
 ('b5cvSb2cvFo','youtube','Nội thất','Bàn làm việc chất liệu ngọc trong'),
 ('EPoVZ6pX6sI','youtube','Bếp & Thiết bị F&B','Bếp BBQ ngoài trời inox'),
 ('XbNJHRlibcI','youtube','Bếp & Thiết bị F&B','Xe bán hàng lưu động F&B'),
 ('jppY8qVHNwg','youtube','Decor & Cảm hứng','Lụa tơ tằm cao cấp'),
 ('YBTRnvWdXiU','youtube','Nội thất','Ghế đọc sách gỗ nguyên khối'),
 ('https://files.catbox.moe/uztr9c.mp4','video','Bếp & Thiết bị F&B','Không gian bếp Ý hiện đại'),
 ('https://files.catbox.moe/busawj.mp4','video','Máy kinh doanh','Máy in nhãn công nghiệp'),
 ('https://files.catbox.moe/3xj77l.mp4','video','Nội thất','Quầy bar một hàng cho cà phê & bar'),
 ('https://files.catbox.moe/5xpuig.mp4','video','Bếp & Thiết bị F&B','Bếp ga 48 inch kèm lò nướng'),
 ('https://files.catbox.moe/xekx0q.mp4','video','Nội thất','Bàn làm việc Adrien'),
 ('https://files.catbox.moe/s93717.mp4','video','Decor & Cảm hứng','Cảm hứng Tuscan thư thái'),
 ('https://files.catbox.moe/nhpwp7.mp4','video','Ngoài trời & Sân vườn','Ô dù Milan ngoài trời'),
 ('https://files.catbox.moe/dnymcw.mp4','video','Máy kinh doanh','Photo booth — mô hình kinh doanh nhỏ'),
]

CATEGORIES = ['Nội thất','Bếp & Thiết bị F&B','Máy kinh doanh','Thiết bị Gym',
              'Ngoài trời & Sân vườn','Decor & Cảm hứng','Đóng gói & Logistics']

RSS = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCGfUe5ljqW9n2ZsSLXgcbPA'

RULES = [
 (r'gym|smith|tập luyện|fitness|squat|rack tập','Thiết bị Gym'),
 (r'bếp|kitchen|tủ lạnh|quán|f&b|bar|cà phê|café|nhà hàng|bbq|food|bàn ăn','Bếp & Thiết bị F&B'),
 (r'photo ?booth|sticker|máy in|in nhãn|vending|kiosk|máy','Máy kinh doanh'),
 (r'vườn|ngoài trời|parasol|ô dù|sân|hộp hoa|cây cảnh','Ngoài trời & Sân vườn'),
 (r'decor|cảm hứng|vintage|phong cách|trang trí|lụa|tuscan','Decor & Cảm hứng'),
 (r'đóng gói|packing|logistics|giao hàng|vận chuyển','Đóng gói & Logistics'),
 (r'ghế|sofa|bàn|kệ|giường|tủ|nội thất|đèn|thảm|lò sưởi|desk','Nội thất'),
]

def classify(title):
    t = (title or '').lower()
    for pat, cat in RULES:
        if re.search(pat, t):
            return cat
    return None

def fetch_rss():
    try:
        req = urllib.request.Request(RSS, headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read()
        root = ET.fromstring(body)
        ns = {'a':'http://www.w3.org/2005/Atom','yt':'http://www.youtube.com/xml/schemas/2015'}
        out = []
        for e in root.findall('a:entry', ns):
            out.append({
                'id': e.find('yt:videoId', ns).text,
                'title': e.find('a:title', ns).text,
                'published': e.find('a:published', ns).text,
            })
        return out
    except Exception as ex:
        print('WARN: RSS fetch failed:', ex)
        return []

def main():
    db_by_id = {vid: (cat, title) for vid, typ, cat, title in DB_VIDEOS if typ == 'youtube'}
    rss = fetch_rss()
    print('RSS entries:', len(rss))

    items, seen = [], set()
    # 1. Fresh channel uploads first (RSS order = newest first)
    for e in rss:
        vid = e['id']
        if vid in seen:
            continue
        seen.add(vid)
        if vid in db_by_id:
            cat = db_by_id[vid][0]
        else:
            cat = classify(e['title'])
        items.append({'id': vid, 'type': 'youtube', 'title': e['title'],
                      'category': cat, 'published': e['published']})
    # 2. DB YouTube videos not present in RSS
    for vid, typ, cat, title in DB_VIDEOS:
        if typ != 'youtube' or vid in seen:
            continue
        seen.add(vid)
        items.append({'id': vid, 'type': 'youtube', 'title': title, 'category': cat})
    # 3. Direct MP4 videos
    for url, typ, cat, title in DB_VIDEOS:
        if typ != 'video':
            continue
        items.append({'url': url, 'type': 'video', 'title': title, 'category': cat})

    data = {'categories': CATEGORIES, 'shorts': items}
    with open('content/yt-shorts.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    cats = {}
    for it in items:
        cats[it['category']] = cats.get(it['category'], 0) + 1
    print('total videos:', len(items))
    for c, n in sorted(cats.items(), key=lambda x: str(x[0])):
        print(' ', c, n)
    print('uncategorized:', sum(1 for it in items if not it['category']))
    print('written content/yt-shorts.json')

if __name__ == '__main__':
    main()
