# TruyenFull Live

Web đọc truyện chữ (React 19 + Vite + Tailwind 4). Hỗ trợ đọc offline, đánh dấu, ghi chú,
chế độ đọc tuỳ biến, TTS, quảng cáo/Shopee affiliate và cổng quản trị.

## Chạy & build
```bash
npm install
cp .env.example .env     # đặt VITE_ADMIN_PASSWORD
npm run dev              # http://localhost:3000
npm run build            # xuất ra dist/ (static site, deploy lên Netlify/Vercel/Nginx...)
```

## Cổng quản trị
Bấm "Cổng Quản Trị Viên" ở footer, nhập mật khẩu `VITE_ADMIN_PASSWORD`.
Mật khẩu được kiểm tra phía client nên chỉ ngăn người dùng thường.

## Giới hạn hiện tại
- Toàn bộ dữ liệu (truyện, chương, quảng cáo, lịch sử) lưu trong `localStorage` của từng trình duyệt,
  khởi tạo từ `src/data/mockStories.ts`. Thay đổi của admin chỉ có hiệu lực trên máy admin.
- "Crawler" là mô phỏng (`src/services/crawlerSimulator.ts`), chưa thu thập từ nguồn thật.
- Để chạy thật cho nhiều người dùng cần backend + database + xác thực phía server.
