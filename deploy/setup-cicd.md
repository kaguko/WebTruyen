# Thiết lập CI/CD (tự động deploy bằng GitHub Actions)

Mỗi khi có commit vào `main`, workflow `.github/workflows/deploy.yml` sẽ SSH vào VPS và chạy: `git pull` → backup → `docker compose up -d --build` → kiểm tra `/api/health`.

> **Giới hạn:** Claude không làm được các bước thủ công dưới đây (tạo key trên máy bạn, dán key vào VPS, thêm Secrets trên GitHub). Bạn tự làm theo hướng dẫn. **Không gửi private key cho ai, kể cả Claude.**

Thông tin VPS hiện tại: Amazon Linux 2023, user `ec2-user`, thư mục `/opt/WebTruyen`.

## 1. Tạo SSH key riêng cho GitHub (trên Windows)
Mở PowerShell:
```powershell
ssh-keygen -t ed25519 -C "github-deploy" -f $env:USERPROFILE\.ssh\github_deploy
```
Khi hỏi passphrase, **để trống** (bấm Enter 2 lần; GitHub Actions không nhập được passphrase). Sẽ có 2 file:
- `github_deploy` — private key (bí mật)
- `github_deploy.pub` — public key

## 2. Dán public key vào VPS
Đăng nhập VPS bằng key AWS cũ:
```powershell
ssh -i webtruyen-key.pem ec2-user@<IP-VPS>
```
Rồi trên VPS (thay nội dung trong dấu nháy bằng nội dung file `github_deploy.pub`, một dòng):
```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "ssh-ed25519 AAAA... github-deploy" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```
Test từ Windows: `ssh -i $env:USERPROFILE\.ssh\github_deploy ec2-user@<IP-VPS>` phải vào được không hỏi mật khẩu.

## 3. Chuẩn bị thư mục trên VPS (làm 1 lần)
```bash
cd /opt/WebTruyen
git status                      # phải sạch, đang ở nhánh main
git remote -v                   # repo là private: cần cách pull không hỏi mật khẩu
```
Vì repo **private**, VPS cần quyền pull. Cách dễ nhất là Deploy key (chỉ đọc):
```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/github_pull -C "vps-pull"
cat ~/.ssh/github_pull.pub      # copy dòng này
```
GitHub repo → Settings → Deploy keys → Add deploy key → dán (không tick Write access). Rồi trên VPS:
```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/github_pull\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config
git remote set-url origin git@github.com:kaguko/WebTruyen.git
ssh -T git@github.com           # chấp nhận fingerprint lần đầu; báo "successfully authenticated" là được
git pull --ff-only origin main
```
Đảm bảo `ec2-user` chạy được docker không cần sudo: `docker ps` (nếu lỗi: `sudo usermod -aG docker ec2-user` rồi đăng nhập lại) và `./deploy/backup.sh` chạy được.

## 4. Thêm 3 GitHub Secrets
Repo trên GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Tên | Giá trị |
|---|---|
| `SSH_HOST` | IP hoặc tên miền của VPS |
| `SSH_USER` | `ec2-user` |
| `SSH_PRIVATE_KEY` | toàn bộ nội dung file `github_deploy` (private key), gồm cả dòng `-----BEGIN ...` và `-----END ...` |

Lấy private key trên Windows: `Get-Content $env:USERPROFILE\.ssh\github_deploy | Set-Clipboard`

## 5. Test chạy tay
1. Merge PR chứa workflow vào `main`.
2. Tab **Actions** → chọn **Deploy to VPS** → **Run workflow** → nhánh `main` → Run.
3. Bấm vào lần chạy để xem log. Xanh ✅ là deploy xong; kiểm tra `https://<tên-miền>/api/health`.
4. Sau đó push 1 commit nhỏ vào `main` để thử chạy tự động.

## 6. Khi workflow bị lỗi
| Triệu chứng trong log | Cách xử lý |
|---|---|
| `ssh: handshake failed` / `unable to authenticate` | Sai `SSH_PRIVATE_KEY` (thiếu dòng BEGIN/END, copy thiếu) hoặc public key chưa nằm trong `~/.ssh/authorized_keys`, hoặc sai `SSH_USER`. |
| `i/o timeout` / `connection refused` | Sai `SSH_HOST`, hoặc Security Group chưa mở cổng 22 cho GitHub (IP của GitHub Actions thay đổi; nếu bạn giới hạn SSH theo IP cá nhân thì workflow sẽ không vào được). |
| `Permission denied (publickey)` ở bước `git pull` | Chưa làm Deploy key ở bước 3. |
| `fatal: Not possible to fast-forward` | VPS có commit/sửa tay lệch với main. SSH vào xem `git status`, xử lý rồi chạy lại. |
| `permission denied ... docker.sock` | `ec2-user` chưa thuộc nhóm docker (bước 3). |
| `Health check FAILED` | Xem log in ra cuối, hoặc trên VPS: `docker compose logs app`. Thường do thiếu/sai `.env`. Bản backup trước deploy nằm ở `/opt/WebTruyen/backups`. |

SSH vào VPS bằng key AWS cũ (`webtruyen-key.pem`) vẫn dùng được để sửa tay khi cần.

## 7. Bảo mật
- Không commit `*.pem`, `*.key`, `.env` (đã chặn trong `.gitignore`).
- Nếu nghi lộ private key: xoá dòng `github-deploy` trong `~/.ssh/authorized_keys` trên VPS, tạo key mới và cập nhật Secret.
