# TruyenFull Live

Web đọc truyện chữ: React 19 + Vite + Tailwind 4 (frontend), Express + SQLite (backend, `node:sqlite`, cần Node ≥ 22.13).

## Kiến trúc
- **Server-side (dùng chung mọi độc giả):** truyện, chương, quảng cáo/Shopee, thông báo, bình luận → SQLite (`DATA_DIR/truyen.db`).
- **Trên trình duyệt từng độc giả:** lịch sử đọc, tủ truyện, ghi chú, cài đặt đọc, bản tải offline (localStorage). Chưa có tài khoản độc giả.
- **Admin:** đăng nhập bằng `ADMIN_PASSWORD`, phiên lưu bằng cookie HttpOnly ký HMAC; mọi API ghi đều yêu cầu phiên admin.
- **Crawler:** server tải trang mục lục + từng chương, bóc nội dung theo CSS selector admin nhập; chương N = link thứ N, chỉ tải chương chưa có. Có thể quét tự động (`CRAWL_INTERVAL_MIN`).

## Chạy phát triển
```bash
npm install
cp .env.example .env   # rồi export các biến (hoặc dùng: set -a; . ./.env; set +a)
npm run dev            # web http://localhost:3000, API :3001 (proxy tự động)
```

## Triển khai
```bash
npm run build && npm start        # hoặc: docker build -t truyen . && docker run -p 3000:3000 -v truyen-data:/data --env-file .env truyen
```
Khi chạy thật: đặt `ADMIN_PASSWORD`, `SESSION_SECRET`, `SEED_DEMO=false`, chạy sau HTTPS (Nginx/Caddy) với `TRUST_PROXY=1`, và **backup thư mục dữ liệu** định kỳ.

## Việc cần làm cùng khách
- Thay truyện mẫu, ảnh, link Shopee affiliate, tên thương hiệu/footer.
- Trang điều khoản/chính sách; chỉ crawl nội dung có quyền sử dụng.
- Chưa có: tài khoản độc giả (đồng bộ đa thiết bị).

## URL & SEO
- URL: `/`, `/the-loai/<the-loai>`, `/truyen/<slug>`, `/truyen/<slug>/chuong-<n>`.
- Ở production, server chèn sẵn `<title>`, meta description, canonical, Open Graph, JSON-LD (Book/BreadcrumbList) và nội dung dự phòng (tiêu đề, mô tả, nội dung chương) vào HTML để Google/mạng xã hội đọc được; trang không tồn tại trả HTTP 404.
- `/sitemap.xml` (tối đa 50.000 URL) và `/robots.txt` tự sinh. **Đặt `SITE_URL=https://ten-mien-that.com`** để canonical/sitemap đúng tên miền.
- Sau khi lên tên miền thật: gửi sitemap vào Google Search Console.
- Lưu ý: chế độ `npm run dev` không chèn SEO (chỉ có ở `npm start`). Slug truyện được giữ cố định kể cả khi đổi tên.

## API chương (phân trang)
`GET /api/stories/:id/chapters?offset=0&limit=50&q=` (danh sách, không có nội dung) · `GET /api/stories/:id/chapters/:n` (một chương) · `GET /api/stories/:id/download` (toàn bộ, dùng cho đọc offline).
