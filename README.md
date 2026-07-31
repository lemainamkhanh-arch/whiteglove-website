# White Glove Logistics Vietnam — Website

Website tĩnh cho **whiteglove.vn** — dịch vụ giao hàng & lắp đặt cao cấp tại TP.HCM.

## Cấu trúc

```
index.html      # Toàn bộ trang (HTML + CSS + JS inline)
assets/         # 14 ảnh JPEG (img-01 → img-14)
```

## Chỉnh sửa

Sửa trực tiếp `index.html` trên GitHub (nút ✏️ Edit). Ảnh tham chiếu theo đường dẫn tương đối `assets/img-XX.jpg` — thay ảnh thì upload đè cùng tên file.

## Deploy (Cloudflare Pages)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → chọn repo này
2. Build settings: không cần build command, output directory = `/` (root)
3. **Custom domains** → thêm `whiteglove.vn` (và `www.whiteglove.vn`)
4. Trỏ DNS/nameserver của domain tại nhà đăng ký .vn theo hướng dẫn của Cloudflare

Sau khi kết nối, mỗi commit lên `main` sẽ tự động deploy.
