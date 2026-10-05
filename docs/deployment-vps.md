# Deploy DICA Backend lên VPS

Thiết kế production gồm ba service:

- `postgres`: PostgreSQL nội bộ, không publish cổng `5432`.
- `migrate`: chạy `prisma migrate deploy` một lần và phải thành công.
- `api`: chỉ khởi động sau khi database healthy và migration hoàn tất; cổng API chỉ bind vào `127.0.0.1` của VPS để reverse proxy truy cập.

GitHub Actions kiểm tra source, build image, push lên GHCR và deploy đúng image digest lên VPS. Secret không được build vào image hoặc commit vào repository.

## 1. Chuẩn bị VPS

Cài Docker Engine và Docker Compose plugin theo tài liệu chính thức của Docker. Tạo user deploy riêng, thêm public key dùng bởi GitHub Actions và cấp quyền chạy Docker. Lưu ý: thành viên group `docker` có quyền tương đương root trên máy.

```bash
sudo install -d -o deploy -g deploy -m 750 /opt/dica-backend
sudo usermod -aG docker deploy
```

Đăng xuất rồi đăng nhập lại để group mới có hiệu lực. Kiểm tra:

```bash
docker version
docker compose version
```

Nếu GHCR package ở chế độ private, đăng nhập một lần trên VPS bằng token chỉ có quyền `read:packages`:

```bash
printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

Không lưu token trong `.env.production`.

## 2. Tạo cấu hình production

Sao chép `.env.production.example` thành `/opt/dica-backend/.env.production`, sau đó sửa toàn bộ giá trị placeholder:

```bash
cp .env.production.example /opt/dica-backend/.env.production
chmod 600 /opt/dica-backend/.env.production
openssl rand -hex 32
openssl rand -hex 48
openssl rand -hex 48
```

- Chuỗi hex đầu tiên dùng đồng thời cho `POSTGRES_PASSWORD` và phần password trong `DATABASE_URL`.
- Hai chuỗi tiếp theo lần lượt dùng cho `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET`; hai secret phải khác nhau.
- `CORS_ORIGINS` phải là domain HTTPS thật của frontend.
- Không bật `DEMO_POLICY_ENABLED` hoặc Swagger ở production nếu không có nhu cầu rõ ràng.
- Compose đặt `TRUST_PROXY_HOPS=1` vì API chỉ nhận traffic qua một reverse proxy trên VPS. Nếu kiến trúc có CDN/proxy bổ sung, chỉ tăng giá trị sau khi xác định chính xác chuỗi proxy.

## 3. Reverse proxy và TLS

API được publish tại `127.0.0.1:3000`; không mở port 3000 trong firewall.

### Cấu hình Nginx kết hợp cả Web (Next.js :3001) và Backend (NestJS :3000)

Nếu chạy cả `dica-web` và `dica-backend` trên cùng VPS, khuyên dùng cấu hình **Unified Single Domain** (ví dụ `dica.example.com`), trong đó `/api/` chuyển tiếp vào backend và các path khác vào web. Xem chi tiết file cấu hình hoàn chỉnh tại repository `dica-web`: `nginx/conf.d/dica-unified.conf`.

Tóm tắt Nginx cho cả hai service:

```nginx
upstream dica_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

upstream dica_web {
    server 127.0.0.1:3001;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name dica.example.com;

    client_max_body_size 10m;

    # Backend API:
    location /api/ {
        proxy_pass http://dica_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
    }

    # Next.js Static Cache:
    location /_next/static/ {
        proxy_pass http://dica_web;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Frontend Web:
    location / {
        proxy_pass http://dica_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Cấu hình chứng chỉ TLS bằng Certbot, Caddy hoặc cơ chế quản lý certificate hiện có. Chỉ public `80/443` và SSH; PostgreSQL không cần public.

## 4. GitHub Environment và secrets

Tạo Environment tên `production`. Có thể bật required reviewers để mỗi lần deploy cần phê duyệt. Khai báo:

### Secrets

| Tên                   | Nội dung                             |
| --------------------- | ------------------------------------ |
| `VPS_HOST`            | IP hoặc hostname VPS                 |
| `VPS_USER`            | User deploy, ví dụ `deploy`          |
| `VPS_SSH_PRIVATE_KEY` | Private key riêng cho GitHub Actions |
| `VPS_SSH_KNOWN_HOSTS` | Dòng host key đã xác minh của VPS    |

Lấy host key bằng lệnh dưới đây, nhưng phải đối chiếu fingerprint với VPS qua một kênh tin cậy trước khi lưu secret:

```bash
ssh-keyscan -p 22 -H api.example.com
```

### Variables tùy chọn

| Tên               | Mặc định            |
| ----------------- | ------------------- |
| `VPS_PORT`        | `22`                |
| `VPS_DEPLOY_PATH` | `/opt/dica-backend` |

Workflow chỉ chấp nhận deploy path nằm dưới `/opt` hoặc `/srv`. Push hoặc chạy thủ công workflow trên branch `main` sẽ:

1. Chạy audit dependency, typecheck, test, format check và build.
2. Build image `linux/amd64`, tạo SBOM/provenance và push lên GHCR.
3. Pin deploy bằng `image@sha256:digest`, không dùng tag mutable.
4. Upload Compose qua SSH, validate cấu hình, pull image.
5. Chờ PostgreSQL healthy, chạy migration và chỉ sau đó khởi động API.
6. Chờ healthcheck API trước khi job thành công.

## 5. Deploy thủ công lần đầu

Nếu chưa dùng workflow, từ thư mục `/opt/dica-backend`:

```bash
export APP_IMAGE=ghcr.io/OWNER/REPOSITORY:latest
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production pull
docker compose --env-file .env.production up -d --remove-orphans --wait
docker compose --env-file .env.production ps
curl --fail http://127.0.0.1:3000/api/v1/health/ready
```

Build và thử image local trước khi push:

```bash
docker build --tag dica-backend:local .
APP_IMAGE=dica-backend:local APP_PULL_POLICY=never \
  docker compose --env-file .env.production up -d --wait
```

## 6. Vận hành và rollback

Xem log:

```bash
docker compose --env-file .env.production logs -f --tail=200 api
docker compose --env-file .env.production logs migrate
```

Workflow ghi digest hiện tại vào `.deployed-image` và digest trước đó vào `.previous-image`. Có thể rollback application bằng:

```bash
export APP_IMAGE="$(cat .previous-image)"
docker compose --env-file .env.production up -d --remove-orphans --wait
```

Migration database không tự rollback. Trước mỗi release có migration phá vỡ tương thích, phải backup và kiểm tra chiến lược expand/contract; chỉ rollback application khi schema mới vẫn tương thích với image cũ.

Backup cơ bản:

```bash
docker compose --env-file .env.production exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "dica-$(date +%F-%H%M%S).dump"
```

Không chạy `docker compose down -v` trên production vì tùy chọn `-v` xóa volume database.
