# White Glove Logistics Vietnam — Website

Website tĩnh cho **whiteglove.vn** — dịch vụ giao hàng & lắp đặt cao cấp tại TP.HCM.

## Cấu trúc

```
template.html      # Khung HTML (KHÔNG sửa text ở đây)
content/site.json  # Toàn bộ text hiển thị (209 trường) — sửa ở đây hoặc qua /admin
build.js           # Ghép template + content → index.html
index.html         # File build ra (không sửa tay)
assets/            # 14 ảnh JPEG
admin/             # Sveltia CMS — giao diện quản trị tại /admin
```

## Sửa nội dung

- **Qua admin panel**: vào `whiteglove.vn/admin`, đăng nhập GitHub, sửa text / thay ảnh → CMS tự commit → site tự deploy.
- **Qua GitHub**: sửa `content/site.json` (text) hoặc upload đè ảnh cùng tên trong `assets/`.

## Deploy (Cloudflare Pages)

1. Workers & Pages → Create → Pages → Connect to Git → chọn repo này
2. Build command: `node build.js` — Output directory: `/` (root)
3. Custom domains: thêm `whiteglove.vn` + `www.whiteglove.vn`, trỏ DNS theo hướng dẫn

## Kích hoạt đăng nhập admin (làm 1 lần)

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App
   - Homepage: `https://whiteglove.vn`
   - Callback URL: `https://<auth-worker>.workers.dev/callback`
2. Deploy [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) lên Cloudflare Workers (nút Deploy 1-click trong repo đó), điền `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`
3. Sửa `admin/config.yml` → `base_url:` = URL của Worker vừa deploy
