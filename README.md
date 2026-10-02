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
- Chưa có: tài khoản độc giả (đồng bộ đa thiết bị), phân trang danh sách chương (API trả toàn bộ chương của truyện), sitemap/SEO theo từng truyện (hiện là SPA không có URL riêng cho truyện).
