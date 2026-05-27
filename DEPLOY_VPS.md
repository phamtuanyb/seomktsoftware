# VPS Docker Deploy

This guide deploys the full stack on one Ubuntu VPS with Docker Compose.

## 1. Copy the project to the VPS

Recommended target path:

```bash
mkdir -p /opt/mkt-seo-ai
```

Copy the repository contents into `/opt/mkt-seo-ai`.

## 2. Create production env

```bash
cd /opt/mkt-seo-ai
cp .env.production.example .env
```

Edit `.env`:

```bash
nano .env
```

Required changes:

- `POSTGRES_PASSWORD`
- `DATABASE_URL` password portion
- `JWT_SECRET` from `openssl rand -hex 32`
- `ENCRYPTION_MASTER_KEY` from `openssl rand -hex 32`
- `ANTHROPIC_API_KEY` if using real Claude generation
- `APP_URL`, `API_URL`, `NEXT_PUBLIC_APP_URL`, `CORS_ORIGINS` when a domain is attached

## 3. Build and start data services

```bash
docker compose -f docker-compose.prod.yml up -d --build postgres redis
```

## 4. Run migrations

```bash
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @mkt-seo/database migrate:deploy
```

Optional seed:

```bash
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @mkt-seo/database seed
```

## 5. Start the app

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check status:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
```

## 6. Nginx reverse proxy

Without a domain, proxy the VPS IP to the web container:

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3006;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

With a domain, replace `server_name _;` with the domain and run Certbot:

```bash
sudo certbot --nginx -d example.com
```

## 7. Smoke checks

```bash
curl http://127.0.0.1:3005/health
curl http://127.0.0.1:3006
```

Public check:

```bash
curl http://103.249.200.193
```
