# Thiết lập CI/CD (tự động deploy bằng GitHub Actions + AWS SSM)

Mỗi khi có commit vào `main`, workflow `.github/workflows/deploy.yml` gọi **AWS Systems Manager (SSM)** để chạy trên VPS: `git pull` → backup → `docker compose up -d --build` → kiểm tra `/api/health`.

Cách này **không dùng SSH**: không cần mở cổng 22, không cần SSH key. GitHub chỉ gọi API của AWS.

> **Giới hạn:** Claude không thao tác được trên tài khoản AWS/GitHub của bạn. Các bước dưới đây bạn tự bấm trên web. **Không gửi Access Key cho ai, kể cả Claude.**

Thông tin hiện tại: VPS Amazon Linux 2023, thư mục `/opt/WebTruyen`, user chạy docker là `ec2-user`.

## Phần A. Cho VPS nhận lệnh từ SSM (làm 1 lần)

### A1. Tạo IAM Role cho VPS
1. AWS Console → **IAM** → **Roles** → **Create role**.
2. Trusted entity type: **AWS service** → Use case: **EC2** → Next.
3. Ô tìm kiếm policy: gõ `AmazonSSMManagedInstanceCore` → tick → Next.
4. Role name: `EC2-SSM-Role` → **Create role**.

### A2. Gắn Role vào VPS
1. **EC2** → **Instances** → tick vào VPS.
2. **Actions → Security → Modify IAM role** → chọn `EC2-SSM-Role` → **Update IAM role**.
3. Đợi khoảng 5 phút. (Nếu sau đó vẫn không thấy ở A3, vào Instance → **Reboot**.)

### A3. Kiểm tra VPS đã kết nối SSM
- AWS Console → **Systems Manager** → **Fleet Manager** (hoặc **Node Management → Fleet Manager**). VPS phải hiện trạng thái **Online**.
- Hoặc EC2 → chọn instance → **Connect** → tab **Session Manager** → **Connect**. Nếu mở được cửa sổ dòng lệnh là xong.

Ghi lại **Instance ID** (dạng `i-0123456789abcdef0`) và **Region** (góc trên bên phải console, ví dụ `ap-southeast-2`).

### A4. Chuẩn bị VPS để `git pull` không hỏi mật khẩu
Trong Session Manager (A3), chạy từng khối:
```bash
sudo -u ec2-user -H bash
cd /opt/WebTruyen
git status                      # phải sạch, đang ở nhánh main
git remote -v
```
Repo là **private**, nên VPS cần quyền đọc. Dùng Deploy key (chỉ đọc):
```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/github_pull -C "vps-pull"
cat ~/.ssh/github_pull.pub      # copy dòng này
```
GitHub repo → **Settings → Deploy keys → Add deploy key** → dán (không tick Write access). Rồi trên VPS:
```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/github_pull\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config
git remote set-url origin git@github.com:kaguko/WebTruyen.git
ssh -T git@github.com           # gõ yes lần đầu; báo "successfully authenticated" là được
git pull --ff-only origin main
docker ps                       # phải chạy được không cần sudo
./deploy/backup.sh              # phải chạy được
```
(Việc này dùng kết nối ra ngoài tới github.com, không liên quan tới cổng 22 của VPS.)

## Phần B. Cho GitHub gọi SSM

### B1. Tạo IAM user chỉ có quyền deploy
1. **IAM → Policies → Create policy → JSON**, dán (thay `REGION`, `ACCOUNT_ID` (12 số, xem ở góc trên phải console) và `INSTANCE_ID`):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:REGION:ACCOUNT_ID:instance/INSTANCE_ID",
        "arn:aws:ssm:REGION::document/AWS-RunShellScript"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"],
      "Resource": "*"
    }
  ]
}
```
   Đặt tên `GitHubDeployWebTruyen` → Create policy.
2. **IAM → Users → Create user** → tên `github-deploy` (không cần quyền đăng nhập console) → **Attach policies directly** → chọn `GitHubDeployWebTruyen` → Create user.
3. Mở user → tab **Security credentials** → **Create access key** → chọn **Application running outside AWS** → tạo, rồi copy **Access key ID** và **Secret access key** (secret chỉ hiện một lần).

### B2. Thêm vào GitHub
Repo → **Settings → Secrets and variables → Actions**:

Tab **Secrets** → New repository secret:

| Tên | Giá trị |
|---|---|
| `AWS_ACCESS_KEY_ID` | Access key ID của user `github-deploy` |
| `AWS_SECRET_ACCESS_KEY` | Secret access key tương ứng |
| `SSM_INSTANCE_ID` | Instance ID của VPS, ví dụ `i-0123456789abcdef0` |

Tab **Variables** → New repository variable:

| Tên | Giá trị |
|---|---|
| `AWS_REGION` | Region của VPS, ví dụ `ap-southeast-2` |

Có thể xoá các secret cũ `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` vì không còn dùng.

## Phần C. Test
1. Tab **Actions** → **Deploy to VPS** → **Run workflow** → nhánh `main` → Run.
2. Mở lần chạy để xem log. Xanh ✅ là xong; kiểm tra `https://<tên-miền>/api/health`.
3. Sau đó push 1 commit nhỏ vào `main` để thử chạy tự động.

## Khi workflow bị lỗi
| Triệu chứng trong log | Cách xử lý |
|---|---|
| `Unable to locate credentials` / `InvalidClientTokenId` | Sai hoặc thiếu `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. |
| `You must specify a region` | Chưa tạo Variable `AWS_REGION` (phải ở tab **Variables**, không phải Secrets). |
| `AccessDeniedException ... ssm:SendCommand` | Policy ở B1 sai `REGION`, `ACCOUNT_ID` hoặc `INSTANCE_ID`. |
| `InvalidInstanceId` | Instance ID sai, hoặc VPS chưa Online trong SSM (làm lại A1–A3). |
| `Trạng thái: Failed` | Đọc phần log in ra bên dưới (lỗi thật của lệnh trên VPS). Thường gặp: `git pull` bị từ chối (chưa làm A4), `docker.sock permission denied`, thiếu `.env`. |
| `Health check FAILED` | Log cuối có 50 dòng của app; hoặc trên VPS: `docker compose logs app`. Bản backup trước deploy nằm ở `/opt/WebTruyen/backups`. |
| `Not possible to fast-forward` | VPS có sửa tay lệch với main. Vào Session Manager, `git status`, xử lý rồi chạy lại. |

## Bảo mật
- Không commit `*.pem`, `*.key`, `.env` (đã chặn trong `.gitignore`).
- User `github-deploy` chỉ có quyền gửi lệnh tới đúng VPS này. Nếu nghi lộ key: IAM → user → xoá access key cũ, tạo key mới, cập nhật Secret.
- Sau khi dùng SSM ổn định, bạn có thể đóng cổng 22 trong Security Group (vẫn vào VPS qua Session Manager).
