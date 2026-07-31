# White Glove Logistics Vietnam — Website

Website tĩnh cho **whiteglove.vn** — dịch vụ giao hàng & lắp đặt cao cấp tại TP.HCM.

🟢 **Site đang chạy**: https://lemainamkhanh-arch.github.io/whiteglove-website/

## Cấu trúc

```
template.html      # Khung HTML (KHÔNG sửa text ở đây)
content/site.json  # Toàn bộ text hiển thị (209 trường) — sửa ở đây hoặc qua /admin
build.js           # Ghép template + content → index.html
index.html         # File build ra (không sửa tay)
assets/            # 14 ảnh JPEG
admin/             # Sveltia CMS — giao diện quản trị tại /admin
.github/workflows/ # Auto-deploy: mỗi commit lên main → build → GitHub Pages
```

## Sửa nội dung

- **Qua admin panel**: vào `/admin`, đăng nhập GitHub, sửa text / thay ảnh → CMS tự commit → site tự deploy sau ≈ 1 phút.
- **Qua GitHub**: sửa `content/site.json` (text) hoặc upload đè ảnh cùng tên trong `assets/`.

## Deploy (GitHub Pages — đang hoạt động)

Tự động hoàn toàn: push lên `main` → GitHub Actions chạy `node build.js` → deploy. Không cần thao tác gì thêm.

## Gắn domain whiteglove.vn (làm 1 lần)

1. Repo → Settings → Pages → **Custom domain**: nhập `whiteglove.vn` → Save
2. Tại nhà đăng ký tên miền .vn, tạo DNS:
   - `A` `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` `www` → `lemainamkhanh-arch.github.io`
3. Chờ xác minh xong → bật **Enforce HTTPS**

*(Sau này muốn chuyển sang Cloudflare Pages vẫn được — kiến trúc không đổi.)*

## Kích hoạt đăng nhập admin (làm 1 lần)

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App
   - Homepage: `https://whiteglove.vn`
   - Callback URL: `https://<auth-worker>.workers.dev/callback`
2. Deploy [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) lên Cloudflare Workers (Deploy 1-click), điền `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`
3. Sửa `admin/config.yml` → `base_url:` = URL của Worker vừa deploy
