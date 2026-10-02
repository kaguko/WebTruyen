# Triển khai lên VPS AWS (EC2 / Lightsail)

Mô hình: 1 máy Ubuntu chạy Docker Compose gồm **app** (Node) + **Caddy** (HTTPS Let's Encrypt tự động). Dữ liệu SQLite nằm ở `./data`.

Cấu hình tối thiểu: Ubuntu 22.04/24.04, 1 vCPU, 1–2 GB RAM (t3.small / Lightsail $5–10), ổ 20 GB.

## 1. Chuẩn bị AWS
1. Tạo instance EC2 (hoặc Lightsail) Ubuntu. Gắn **Elastic IP** (Lightsail: Static IP) để IP không đổi.
2. Security Group / Firewall chỉ mở: **22** (SSH, giới hạn IP của bạn), **80**, **443**. *Không* mở 3000.
3. Trỏ DNS: tạo bản ghi **A** cho `ten-mien-that.com` (và `www` nếu dùng) về Elastic IP. Chờ DNS cập nhật (kiểm tra: `dig +short ten-mien-that.com`).

## 2. Cài Docker trên server
```bash
ssh ubuntu@<IP>
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && exit      # đăng nhập SSH lại để áp dụng nhóm docker
```

## 3. Lấy code và cấu hình
```bash
git clone https://github.com/kaguko/WebTruyen.git && cd WebTruyen
git checkout <nhánh-đã-merge>               # thường là main sau khi merge PR
cp .env.example .env
nano .env
```
Trong `.env` **bắt buộc** đặt:
- `ADMIN_PASSWORD` — mật khẩu mạnh, dài.
- `SESSION_SECRET` — chuỗi ngẫu nhiên: `openssl rand -hex 32`.
- `DOMAIN` và `SITE_URL` — tên miền thật (`SITE_URL=https://ten-mien-that.com`).
- `SEED_DEMO=false` — không nạp truyện mẫu.
- Tùy chọn: `CRAWL_INTERVAL_MIN` để tự quét chương mới.

## 4. Chạy
```bash
docker compose up -d --build
docker compose ps                  # app phải ở trạng thái healthy
docker compose logs -f caddy       # xem Caddy xin chứng chỉ HTTPS
```
Mở `https://ten-mien-that.com`. Vào "Cổng Quản Trị Viên" ở cuối trang để đăng nhập admin.

Kiểm tra nhanh: `curl -I https://ten-mien-that.com/api/health`, `https://ten-mien-that.com/sitemap.xml`.

## 5. Sao lưu (bắt buộc)
```bash
./deploy/backup.sh                                   # thử 1 lần
crontab -e   # thêm dòng:
0 3 * * * cd /home/ubuntu/WebTruyen && ./deploy/backup.sh >> backups/backup.log 2>&1
```
Bản backup nằm ở `./backups` (giữ 14 bản). **Chép định kỳ ra ngoài máy** (ví dụ `aws s3 cp backups/ s3://ten-bucket/ --recursive`) và bật snapshot EBS/Lightsail. Khôi phục: dừng app, giải nén `.gz` thành `data/truyen.db`, chạy lại.

## 6. Cập nhật phiên bản mới
```bash
cd ~/WebTruyen && ./deploy/update.sh      # pull, backup, build, restart
```

## 7. Sau khi lên mạng
- Gửi `https://ten-mien-that.com/sitemap.xml` vào Google Search Console.
- Thay nội dung mẫu, ảnh, link Shopee, footer; thêm trang điều khoản.
- Cập nhật hệ điều hành định kỳ: `sudo apt-get update && sudo apt-get upgrade -y`.

## Xử lý sự cố
| Triệu chứng | Cách xử lý |
|---|---|
| Không lấy được HTTPS | DNS chưa trỏ đúng, hoặc cổng 80/443 chưa mở trong Security Group. Xem `docker compose logs caddy`. |
| Đăng nhập admin báo lỗi / không giữ phiên | Truy cập bằng HTTPS (cookie `secure`). Chỉ khi chạy thử HTTP mới đặt `COOKIE_SECURE=false`. |
| `app` restart liên tục | `docker compose logs app`. Thường thiếu `.env` hoặc sai quyền thư mục `data/`. |
| Hết RAM khi build | Thêm swap 2 GB: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`. |
