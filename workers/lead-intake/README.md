# White Glove Lead Intake Worker

Cloudflare Worker nhan du lieu tu form "Yeu cau bao gia" tren whiteglove.vn
va ghi thanh 1 trang moi vao database Lead tren Notion, qua Notion API.

## Trien khai (thu cong, 1 lan)

1. Tao Notion internal integration tai https://www.notion.so/my-integrations
   - Dat ten vi du "WhiteGlove Lead Intake", copy "Internal Integration Secret".
2. Mo database Lead trong Notion > nut "..." (hoac Share) > Connections > them
   integration vua tao vao database do.
3. Lay Database ID: mo database o dang full page, copy 32 ky tu trong URL
   (doan giua ten workspace va dau "?v=").
4. Dien Database ID vao `NOTION_LEAD_DATABASE_ID` trong `wrangler.toml`.
5. Cai wrangler (neu chua co): `npm install -g wrangler`
6. Dang nhap: `wrangler login`
7. Tao secret API key: `wrangler secret put NOTION_API_KEY` (dan Internal
   Integration Secret vua copy o buoc 1).
8. Deploy: trong thu muc `workers/lead-intake`, chay `wrangler deploy`.
9. Wrangler se in ra URL Worker, dang:
   `https://whiteglove-lead-intake.<subdomain>.workers.dev`.
10. Neu URL nay khac voi `WG_LEAD_ENDPOINT` dang hardcode trong `index.html`,
    sua lai gia tri do trong `index.html` roi commit/deploy lai website.

## Kiem tra

Goi thu:
```
curl -X POST https://whiteglove-lead-intake.<subdomain>.workers.dev \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","phone":"0900000000","service":"White Glove Delivery"}'
```
Sau do kiem tra database Lead tren Notion co xuat hien row moi khong.
