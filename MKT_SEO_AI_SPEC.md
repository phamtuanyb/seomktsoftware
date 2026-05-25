# MKT SEO AI — Technical Specification

> File này là tài liệu kỹ thuật duy nhất để AI code triển khai dự án. Mọi quyết định kỹ thuật phải tuân thủ tài liệu này.

---

## 1. Tổng quan

**Sản phẩm:** Nền tảng SaaS multi-tenant cung cấp pipeline SEO end-to-end:

- Nghiên cứu từ khóa
- Sinh nội dung AI đúng phong cách thương hiệu
- Đăng bài tự động lên WordPress

**8 tính năng MVP** (triển khai theo thứ tự):

| #   | Tính năng                               | Module         |
| --- | --------------------------------------- | -------------- |
| 1   | Keyword Suggestion                      | `keywords`     |
| 2   | Keyword Analysis (Volume + KD + Intent) | `keywords`     |
| 3   | AI Outline Generator                    | `content`      |
| 4   | AI Full Article Writer (streaming)      | `content`      |
| 5   | Brand Voice Training                    | `brand-voices` |
| 6   | AI Image Generation                     | `images`       |
| 7   | Content Score 0-100                     | `audit`        |
| 8   | WordPress Auto Publisher                | `publisher`    |

---

## 2. Nguyên tắc thiết kế (BẮT BUỘC tuân thủ)

1. **API-First:** Mọi tính năng có REST endpoint. Frontend chỉ là 1 client.
2. **Modular:** Mỗi tính năng = 1 NestJS module độc lập.
3. **Plugin-Ready:** Cấu trúc cho phép thêm Publisher mới (Shopify, Haravan...), AI provider mới, audit rule mới mà không refactor core.
4. **Event-Driven:** Module giao tiếp qua Redis Pub/Sub, không gọi trực tiếp.
5. **Multi-tenant:** Mọi data record có `user_id`. Mọi query filter theo `user_id`.
6. **Webhook-Ready:** Mở public webhook từ MVP cho user integrate.
7. **i18n-Ready:** Default `vi-VN`, sẵn sàng `en-US`.
8. **Domain qua ENV:** Domain chưa chốt. Mọi URL qua biến môi trường, KHÔNG hard-code.

---

## 3. Pipeline end-to-end

```
[1] Keyword Suggest → [2] Analyze → [3] Outline → [4] Article Writer
                                                       ↓
[8] WP Publisher ← [7] Content Score ← [6] Image Gen ← [5] Brand Voice
```

User journey:

1. **Setup 1 lần:** Tạo Brand Voice từ 5-10 bài mẫu
2. **Mỗi bài mới:** Research keyword → chọn → outline → write (với brand voice) → sinh ảnh → check điểm → publish
3. **Thời gian:** ~15 phút từ keyword đến bài đăng

---

## 4. Tech Stack

### Monorepo

```yaml
Package Manager: pnpm workspace + Turborepo
Folder structure:
  apps/api          # NestJS backend
  apps/web          # Next.js frontend
  packages/shared   # Types, constants
  packages/database # Prisma schema + client
  packages/ui       # Shared shadcn components
  packages/config   # Shared eslint/prettier/tsconfig
```

### Backend (apps/api)

```yaml
Framework: NestJS 10+ với TypeScript strict
Runtime: Node.js 20 LTS
ORM: Prisma 5
Database: PostgreSQL 16
Cache: Redis 7
Queue: BullMQ 5
Auth: Passport.js + JWT + refresh token
Validation: class-validator + class-transformer
Logger: Pino (JSON structured)
API Docs: Swagger UI (auto từ decorators)
Testing: Jest + Supertest
WebSocket: Socket.io (cho streaming AI)
```

### Frontend (apps/web)

```yaml
Framework: Next.js 15 (App Router)
Language: TypeScript strict
UI: TailwindCSS + shadcn/ui
State: Zustand 4
API Client: TanStack Query 5
Form: React Hook Form + Zod
Rich Editor: Tiptap (cho Article Editor)
i18n: next-intl
Icons: lucide-react
```

### AI & External APIs

```yaml
LLM chính: Anthropic Claude (Sonnet 4 + Haiku)
LLM backup: OpenAI GPT-4o
Image Gen: Replicate Flux Schnell (mặc định), DALL-E 3 (premium)
Embedding: OpenAI text-embedding-3-small (cho Phase 2)
SEO Data: DataForSEO API
Image Compress: TinyPNG
Proxy Scraping: Bright Data hoặc ScraperAPI
```

### Storage & Infra

```yaml
File Storage: Cloudflare R2 (S3-compatible)
CDN: Cloudflare
Hosting: DigitalOcean App Platform
CI/CD: GitHub Actions
Monitoring: Sentry + Uptime Robot
Payment: Stripe (international) + Sepay (VN)
Email: SendGrid
Notification: Telegram Bot API
```

### Local Dev Ports

- **API:** `http://localhost:3005`
- **Web:** `http://localhost:3006`
- **Swagger:** `http://localhost:3005/docs`
- **PostgreSQL:** `localhost:5432`
- **Redis:** `localhost:6379`

---

## 5. Module Structure (NestJS)

```
apps/api/src/
├── modules/
│   ├── auth/                    # JWT + refresh token + email verify
│   ├── users/                   # User management
│   ├── billing/                 # Subscription, quota, payment
│   ├── keywords/                # TN1, TN2
│   │   ├── keywords.controller.ts
│   │   ├── keywords.service.ts
│   │   ├── providers/
│   │   │   ├── google-suggest.provider.ts
│   │   │   ├── bing-suggest.provider.ts
│   │   │   ├── paa.provider.ts
│   │   │   └── dataforseo.provider.ts
│   │   └── workers/
│   │       └── keyword-research.worker.ts
│   ├── content/                 # TN3, TN4
│   │   ├── content.controller.ts
│   │   ├── content.service.ts
│   │   ├── providers/
│   │   │   ├── claude.provider.ts
│   │   │   └── openai.provider.ts
│   │   ├── prompts/             # Prompt templates
│   │   └── workers/
│   ├── brand-voices/            # TN5
│   ├── images/                  # TN6
│   │   ├── providers/
│   │   │   ├── flux.provider.ts
│   │   │   └── dalle.provider.ts
│   │   └── workers/
│   ├── audit/                   # TN7
│   │   ├── audit.service.ts
│   │   └── rules/               # 12 SEO scoring rules (Chain of Responsibility)
│   │       ├── keyword-density.rule.ts
│   │       ├── title-keyword.rule.ts
│   │       └── ...
│   ├── publisher/               # TN8 (Adapter pattern - mở rộng Shopify Phase 2)
│   │   ├── publisher.service.ts
│   │   ├── adapters/
│   │   │   ├── publisher.interface.ts
│   │   │   └── wordpress.adapter.ts
│   │   └── workers/
│   │       └── publish.worker.ts
│   ├── webhooks/                # Outgoing webhooks
│   └── plugins/                 # Plugin registry (Phase 2 ready)
├── common/
│   ├── decorators/              # @CurrentUser, @RequireQuota, @RequirePlan, @RequireScope
│   ├── filters/                 # HttpExceptionFilter, PrismaExceptionFilter
│   ├── guards/                  # JwtAuthGuard, QuotaGuard, RoleGuard, ApiKeyGuard
│   ├── interceptors/            # LoggingInterceptor, TransformResponseInterceptor
│   ├── pipes/                   # ValidationPipe
│   ├── services/                # PrismaService, RedisService, EventBusService, QuotaService
│   └── utils/
├── config/                      # database, redis, ai, app configs
├── jobs/                        # Cron jobs
├── events/                      # Event handlers
└── main.ts
```

```
apps/web/src/
├── app/
│   ├── (auth)/                  # login, register, forgot-password
│   ├── (dashboard)/             # main app
│   │   ├── keywords/
│   │   ├── content/
│   │   ├── brand-voices/
│   │   ├── images/
│   │   ├── audit/
│   │   ├── sites/
│   │   └── settings/
│   └── (marketing)/             # landing page
├── components/
│   ├── ui/                      # shadcn base
│   ├── features/                # Feature-specific
│   └── shared/
├── lib/
│   ├── api/                     # TanStack Query hooks
│   ├── stores/                  # Zustand stores
│   ├── utils/
│   └── constants/
├── hooks/
└── styles/
```

### Design Patterns sử dụng

| Pattern                     | Áp dụng cho                      | Lý do                             |
| --------------------------- | -------------------------------- | --------------------------------- |
| **Strategy**                | Publisher adapters, AI providers | Swap provider runtime             |
| **Repository**              | Database access                  | Tách logic DB khỏi business logic |
| **Factory**                 | AI client, image generator       | Choose provider runtime           |
| **Observer (EventBus)**     | Cross-module communication       | Loose coupling qua Redis Pub/Sub  |
| **Adapter**                 | WordPress, Shopify (Phase 2)     | Đồng nhất interface nhiều CMS     |
| **Chain of Responsibility** | Content Score 12 rules           | Dễ thêm rule mới                  |

---

## 6. API Design

### Conventions

```yaml
Base URL Local: http://localhost:3005/api/v1
Base URL Staging: https://{{API_DOMAIN_STAGING}}/v1   # cập nhật khi chốt domain
Base URL Production: https://{{API_DOMAIN_PRODUCTION}}/v1
Versioning: trong URL path (/v1, /v2)
Format: JSON
Authentication: Bearer JWT trong header "Authorization: Bearer <token>"
API Key (Phase 2): Header "X-API-Key: <api_key>"
Date format: ISO 8601
Pagination: cursor-based (cursor + limit, default 20)
```

**Response wrapper:**

```json
{
  "success": true,
  "data": { ... },
  "meta": { "cursor": "...", "has_more": true }
}
```

**Error wrapper:**

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Bạn không đủ credit",
    "details": { "required": 100, "current": 30 }
  }
}
```

### Authentication APIs

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/me
POST   /api/v1/auth/verify-email
```

### Feature APIs

**Keywords (TN1, TN2):**

```
POST   /api/v1/keywords/suggest          # body: { seed, sources?, limit? }
POST   /api/v1/keywords/analyze          # body: { keywords[], analyze_intent? }
GET    /api/v1/keywords/projects
POST   /api/v1/keywords/projects
GET    /api/v1/keywords/projects/:id
DELETE /api/v1/keywords/projects/:id
POST   /api/v1/keywords/projects/:id/keywords
GET    /api/v1/keywords/projects/:id/keywords
DELETE /api/v1/keywords/projects/:id/keywords/:kid
GET    /api/v1/keywords/projects/:id/export?format=csv|excel
```

**Content (TN3, TN4):**

```
POST   /api/v1/content/outline           # body: { keyword, intent?, format?, target_word_count? }
POST   /api/v1/content/article           # body: { outline, brand_voice_id?, tone?, model? }
                                         # Headers: Accept: text/event-stream (streaming SSE)
GET    /api/v1/content/articles
POST   /api/v1/content/articles
GET    /api/v1/content/articles/:id
PATCH  /api/v1/content/articles/:id
DELETE /api/v1/content/articles/:id
POST   /api/v1/content/articles/:id/regenerate-section
POST   /api/v1/content/articles/:id/rewrite
GET    /api/v1/content/articles/:id/export?format=html|md|docx
```

**Brand Voices (TN5):**

```
GET    /api/v1/brand-voices
POST   /api/v1/brand-voices              # body: { name, sample_articles[] }
GET    /api/v1/brand-voices/:id
PATCH  /api/v1/brand-voices/:id
DELETE /api/v1/brand-voices/:id
POST   /api/v1/brand-voices/:id/train
POST   /api/v1/brand-voices/:id/preview  # body: { sample_text? }
```

**Images (TN6):**

```
POST   /api/v1/images/generate           # body: { prompt, style?, aspect_ratio?, count?, model? }
POST   /api/v1/images/generate-for-article  # body: { article_id, include_featured? }
GET    /api/v1/images
GET    /api/v1/images/:id
DELETE /api/v1/images/:id
POST   /api/v1/images/upload
```

**Audit (TN7):**

```
POST   /api/v1/audit/score               # body: { article_id?, title, content, target_keyword, ... }
POST   /api/v1/audit/auto-fix            # body: { article_id, rule_ids? }
```

**Publisher (TN8):**

```
GET    /api/v1/publisher/sites
POST   /api/v1/publisher/sites           # body: { url, username, application_password }
GET    /api/v1/publisher/sites/:id
PATCH  /api/v1/publisher/sites/:id
DELETE /api/v1/publisher/sites/:id
POST   /api/v1/publisher/sites/:id/test
POST   /api/v1/publisher/wordpress       # body: { article_id, site_id, status, scheduled_at?, categories?, tags? }
GET    /api/v1/publisher/jobs
GET    /api/v1/publisher/jobs/:id
DELETE /api/v1/publisher/jobs/:id
POST   /api/v1/publisher/bulk            # body: { jobs[] }
```

**Webhooks (outgoing):**

```
GET    /api/v1/webhooks
POST   /api/v1/webhooks                  # body: { url, events[], secret? }
GET    /api/v1/webhooks/:id
PATCH  /api/v1/webhooks/:id
DELETE /api/v1/webhooks/:id
POST   /api/v1/webhooks/:id/test
GET    /api/v1/webhooks/:id/deliveries
```

**API Keys (Phase 2 ready, DB schema sẵn từ MVP):**

```
GET    /api/v1/api-keys
POST   /api/v1/api-keys                  # body: { name, scopes[], expires_at? }
DELETE /api/v1/api-keys/:id
```

### Webhook Events (outgoing payloads)

| Event                 | Trigger                       |
| --------------------- | ----------------------------- |
| `article.created`     | Bài viết được tạo             |
| `article.completed`   | AI viết xong bài              |
| `article.published`   | Bài publish lên WP thành công |
| `publish.failed`      | Publish thất bại              |
| `brand_voice.trained` | Brand voice train xong        |
| `quota.warning`       | User dùng 80% quota           |

**Payload format:**

```json
{
  "event": "article.published",
  "timestamp": "2026-05-25T10:30:00Z",
  "data": { ... },
  "signature": "sha256=..."
}
```

Verify bằng HMAC-SHA256 với `secret`.

### API Key Scopes (Phase 2)

- `keywords:read`, `keywords:write`
- `content:read`, `content:write`
- `images:read`, `images:write`
- `publisher:read`, `publisher:write`
- `webhooks:manage`

---

## 7. Database Schema (Prisma)

### Conventions

- Tables: `snake_case`, plural
- Columns: `snake_case`
- PK: `id` UUID v7 (sortable by time)
- FK: `<table_singular>_id`
- Timestamps: `created_at`, `updated_at`, `deleted_at` (soft delete)
- JSON columns: `*_json` hoặc `metadata`

### Full SQL DDL

```sql
-- Users & Authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(20),
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'user',
  email_verified_at TIMESTAMP,
  preferences_json JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;

-- Subscription & Billing
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  plan VARCHAR(50) NOT NULL,  -- trial, starter, pro, agency, lifetime
  status VARCHAR(20) NOT NULL,  -- active, cancelled, expired, paused
  started_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,
  stripe_subscription_id VARCHAR(255),
  sepay_payment_id VARCHAR(255),
  metadata_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Quota tracking
CREATE TABLE quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  resource VARCHAR(50) NOT NULL,  -- articles, keywords, sites, brand_voices, images
  period VARCHAR(20) NOT NULL,    -- monthly, lifetime
  used INT DEFAULT 0,
  limit_value INT NOT NULL,
  reset_at TIMESTAMP,
  UNIQUE(user_id, resource, period)
);

-- API Keys (Phase 2 ready)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(100),
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  prefix VARCHAR(10) NOT NULL,            -- "mkt_live_" hoặc "mkt_test_"
  scopes TEXT[] NOT NULL,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

-- Keyword Research
CREATE TABLE keyword_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  seed_keyword VARCHAR(255),
  language VARCHAR(10) DEFAULT 'vi',
  country VARCHAR(10) DEFAULT 'VN',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  project_id UUID REFERENCES keyword_projects(id) ON DELETE CASCADE,
  keyword VARCHAR(500) NOT NULL,
  source VARCHAR(50),                 -- google_suggest, bing, paa, manual
  volume INT,
  keyword_difficulty INT,
  cpc DECIMAL(10,2),
  intent VARCHAR(20),                 -- info, commercial, transactional, navigational
  intent_confidence DECIMAL(3,2),
  metadata_json JSONB,
  analyzed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_keywords_user_project ON keywords(user_id, project_id);
CREATE INDEX idx_keywords_keyword ON keywords USING gin(to_tsvector('simple', keyword));

-- Brand Voices
CREATE TABLE brand_voices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  profile_json JSONB NOT NULL,        -- { tone, sentence_length, addressing, ... }
  reference_articles JSONB NOT NULL,  -- [{ title, content }]
  is_default BOOLEAN DEFAULT false,
  trained_at TIMESTAMP NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_brand_voices_user ON brand_voices(user_id) WHERE deleted_at IS NULL;

-- Articles
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500),
  content TEXT,                       -- HTML
  content_markdown TEXT,
  excerpt TEXT,
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  target_keyword VARCHAR(255),
  secondary_keywords TEXT[],
  outline_json JSONB,
  format VARCHAR(50),                 -- blog, listicle, how-to, ...
  word_count INT,
  content_score INT,
  score_breakdown_json JSONB,
  status VARCHAR(20) DEFAULT 'draft', -- draft, ready, published, archived
  brand_voice_id UUID REFERENCES brand_voices(id),
  featured_image_id UUID,
  ai_model_used VARCHAR(50),
  ai_cost_usd DECIMAL(10,4),
  metadata_json JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_articles_user_status ON articles(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_articles_created ON articles(created_at DESC);

-- Images
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  prompt TEXT,
  alt_text VARCHAR(500),
  style VARCHAR(50),
  aspect_ratio VARCHAR(20),
  width INT,
  height INT,
  file_size_bytes INT,
  model_used VARCHAR(50),
  cost_usd DECIMAL(10,4),
  metadata_json JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Publisher Sites
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  url VARCHAR(500) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'wordpress',  -- wordpress, shopify (Phase 2)
  username VARCHAR(255),
  credentials_encrypted TEXT NOT NULL,            -- AES-256-GCM
  status VARCHAR(20) DEFAULT 'active',
  plugin_seo_detected VARCHAR(50),                -- yoast, rankmath, seopress, none
  metadata_json JSONB,
  last_check_at TIMESTAMP,
  last_publish_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_sites_user ON sites(user_id) WHERE deleted_at IS NULL;

-- Publish Jobs
CREATE TABLE publish_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  article_id UUID NOT NULL REFERENCES articles(id),
  site_id UUID NOT NULL REFERENCES sites(id),
  status VARCHAR(20) NOT NULL,        -- pending, processing, completed, failed, cancelled
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  wp_post_id INT,
  published_url TEXT,
  retry_count INT DEFAULT 0,
  error_message TEXT,
  error_code VARCHAR(50),
  payload_json JSONB,
  response_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_publish_jobs_status_scheduled ON publish_jobs(status, scheduled_at);
CREATE INDEX idx_publish_jobs_user ON publish_jobs(user_id);

-- Webhooks
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  metadata_json JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event VARCHAR(100) NOT NULL,
  payload_json JSONB NOT NULL,
  response_status INT,
  response_body TEXT,
  attempt_count INT DEFAULT 1,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC);

-- Plugins registry (Phase 2 ready)
CREATE TABLE plugins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(20) NOT NULL,
  description TEXT,
  author VARCHAR(255),
  is_official BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT true,
  config_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_plugin_installs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id),
  plugin_id UUID NOT NULL REFERENCES plugins(id),
  config_json JSONB,
  is_active BOOLEAN DEFAULT true,
  installed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, plugin_id)
);
```

---

## 8. Đặc tả 8 tính năng

### TN1: Keyword Suggestion

**Endpoint:** `POST /api/v1/keywords/suggest`

**Request:**

```yaml
seed: string (1-100 chars, required)
sources: string[] (default ['google','bing','paa'])
language: string (default 'vi')
country: string (default 'VN')
limit: number (default 500, max 2000)
```

**Logic:**

1. Check quota `keywords`
2. Check Redis cache (key = hash của seed + sources + lang, TTL 7 ngày)
3. Dispatch jobs đến scraper workers (parallel cho mỗi source)
4. Aggregate + dedupe kết quả
5. Cache + consume quota

**Providers:**

- `GoogleSuggestProvider`: scrape `https://www.google.com/complete/search?client=chrome&q={seed}&hl={lang}`
- `BingSuggestProvider`: scrape `https://api.bing.com/osjson.aspx?query={seed}`
- `PaaProvider`: scrape Google People Also Ask qua proxy

**Proxy:** Bright Data hoặc ScraperAPI rotation, 10 req/s/proxy, retry 3 lần

**Acceptance:**

- ≥200 keyword unique trong <15s
- Dedupe rate <10%
- Cache hit ratio >60% sau 1 tuần
- Error rate <2% (fallback khi 1 source fail)
- Export CSV 500 keyword <5s

---

### TN2: Keyword Analysis (Volume + KD + Intent)

**Endpoint:** `POST /api/v1/keywords/analyze`

**Request:**

```yaml
keywords: string[] (max 500/request, required)
analyze_intent: boolean (default true)
language: string (default 'vi')
country: string (default 'VN')
```

**Logic:**

1. **Volume + CPC:** DataForSEO batch API (100 keyword/request), cache 7 ngày
2. **KD:** crawl top 10 SERP cho mỗi keyword (cache 7 ngày SERP)
   - Công thức: `KD = (avg DA top 10 × 0.4) + (avg backlink × 0.3) + (content length × 0.15) + (domain age × 0.15)`
3. **Intent:** Claude Haiku batch 50 keyword/request
   - 4 nhóm: info, commercial, transactional, navigational
   - Fallback rule-based khi confidence <0.7 (keyword chứa "mua"/"giá" → transactional)

**Acceptance:**

- 500 keyword analyzed <60s
- Volume sai số <20% vs Ahrefs
- KD ±10 điểm vs manual crawl
- Intent accuracy ≥85%
- Cost <100đ/keyword sau cache

---

### TN3: AI Outline Generator

**Endpoint:** `POST /api/v1/content/outline`

**Request:**

```yaml
keyword: string (required)
intent: string (auto-detect nếu không có)
format: 'blog'|'listicle'|'how-to'|'review'|'comparison'|'faq'|'landing'|'product' (default 'blog')
target_word_count: number (1500-5000, default 2000)
language: string (default 'vi')
```

**Logic:**

1. Crawl top 5 SERP cho keyword (cache 24h)
2. Extract heading structure từ HTML (cheerio: parse `<h1>`, `<h2>`, `<h3>`)
3. Build prompt cho Claude Sonnet 4: "Dựa trên 5 outline sau từ top SERP, tạo outline mới chi tiết hơn cho keyword..."
4. Parse JSON output, validate bằng Zod
5. Cache outline 30 ngày

**Output schema:**

```typescript
{
  h1: string,
  sections: [{
    h2: string,
    subsections: [{
      h3: string,
      bullets: string[]
    }]
  }],
  metadata: {
    based_on_serps: string[],
    ai_model: string,
    tokens_used: number
  }
}
```

**Acceptance:**

- Outline 8-12 heading <20s
- 100% có H1 chứa keyword chính
- User accept rate ≥80%

---

### TN4: AI Full Article Writer (FLAGSHIP)

**Endpoint:** `POST /api/v1/content/article`

**Streaming:** Support SSE (Server-Sent Events), header `Accept: text/event-stream`

**Request:**

```yaml
outline: object (required, schema từ TN3)
brand_voice_id: string (optional)
tone: 'expert'|'friendly'|'sales'|'educational'|'storytelling' (optional)
target_word_count: number (default 2000)
model: 'claude-sonnet-4'|'claude-haiku'|'gpt-4o' (default 'claude-sonnet-4')
enable_schema_markup: boolean (default true)
```

**Logic:**

1. Load brand voice nếu có `brand_voice_id`
2. Build system prompt với brand voice profile + 3 reference articles
3. Stream từ Claude API
4. Post-process: inject schema markup JSON-LD, generate meta title + description, bold keyword chính, detect LSI
5. Call audit service (TN7) để score
6. Save DB, emit event `article.completed`

**Bài output bao gồm:**

- Intro hook 150 từ
- Body theo outline
- Bảng so sánh nếu commercial intent
- List numbered nếu how-to
- FAQ section 5-10 câu
- Conclusion + CTA
- Bold keyword chính 3-5 lần
- LSI keyword 10-15 lần
- Meta title + meta description
- Schema markup JSON-LD

**Streaming SSE format:**

```
data: { "type": "token", "content": "từng" }
data: { "type": "token", "content": " từ" }
data: { "type": "section_complete", "section_id": "intro" }
data: { "type": "complete", "article_id": "...", "content_score": 85 }
```

**Acceptance:**

- Bài 2000 từ <90s
- Content Score ≥80
- AI Detection <30% (Originality.ai)
- Cost <3.000đ/bài 2000 từ
- Với brand_voice_id: similarity ≥75% với reference

---

### TN5: Brand Voice Training (USP)

**Endpoint:** `POST /api/v1/brand-voices`

**Request:**

```yaml
name: string (required, max 100)
description: string (optional)
sample_articles: array (min 3, max 20)
  - title: string (optional)
    content: string (min 500 chars, required nếu không có url)
    url: string (optional, sẽ fetch content nếu có)
```

**Logic:**

1. Fetch content từ URL (dùng `@mozilla/readability`)
2. Build analysis prompt cho Claude Sonnet 4:
   ```
   Phân tích {N} bài viết sau và trả về JSON Brand Voice Profile:
   {
     "tone": { "primary": "...", "secondary": [...], "confidence": 0.0-1.0 },
     "sentence_structure": { "avg_words_per_sentence": ..., "short_sentences_pct": ..., "long_sentences_pct": ... },
     "addressing": { "primary": "...", "formality": "..." },
     "signature_phrases": [...],
     "vocabulary": { "complexity": "...", "domain_terms": [...] },
     "emoji_usage": { "enabled": ..., "density": ..., "common_emojis": [...] },
     "patterns": { "opening_style": "...", "closing_style": "...", "cta_style": "..." }
   }
   ```
3. Validate JSON với Zod
4. Select 3-5 reference articles tiêu biểu nhất
5. Save DB + emit `brand_voice.trained`

**Khi viết bài (TN4) với brand_voice_id:**
Inject vào system prompt:

```
Bạn phải viết theo phong cách sau:
- Tone: {profile.tone.primary}
- Xưng hô: {profile.addressing.primary}
- Câu trung bình: {profile.sentence_structure.avg_words_per_sentence} từ
- Cụm từ đặc trưng cần dùng: {profile.signature_phrases.join(', ')}
- Emoji: {emoji info}
- Mở/Kết bài: {patterns}

DƯỚI ĐÂY LÀ 3 BÀI VIẾT MẪU. Hãy bắt chước phong cách:
{reference_articles}
```

**Acceptance:**

- Tạo profile từ 5 bài mẫu <2 phút
- 1 user ≥5 profile
- Similarity ≥75% (manual eval 50 cặp bài)
- User accept rate ≥80% với brand voice (vs 60% không có)

---

### TN6: AI Image Generation

**Endpoints:**

```
POST /api/v1/images/generate              # 1 ảnh đơn lẻ
POST /api/v1/images/generate-for-article  # bulk cho cả bài
```

**Request `/generate`:**

```yaml
prompt: string (5-1000 chars, required)
style: 'realistic'|'illustration'|'3d'|'minimalist'|'infographic'|'mkt-brand' (default 'mkt-brand')
aspect_ratio: '16:9'|'4:3'|'1:1' (default '16:9')
count: number (1-4, default 1)
model: 'flux-schnell'|'dalle-3' (default 'flux-schnell')
```

**Logic:**

1. Safety check prompt (no NSFW, no real person names) qua Claude Haiku
2. Augment prompt với style preset
3. Gọi Replicate Flux Schnell (mặc định, $0.003/ảnh) hoặc DALL-E 3 (premium)
4. Download ảnh → resize (Sharp): featured 1200×630, in-content 800×450
5. Compress qua TinyPNG → upload Cloudflare R2
6. Sinh alt text bằng Claude Haiku từ prompt + context
7. Save DB record

**Acceptance:**

- Sinh 5 ảnh <60s (sequential), <30s (parallel)
- Cost <2.000đ/bài (5 ảnh × ~400đ)
- Alt text 100% chứa keyword
- User accept ảnh đầu ≥70%

---

### TN7: Content Score 0-100

**Endpoint:** `POST /api/v1/audit/score`

**Request:**

```yaml
article_id: string (optional)
title: string
content: string (HTML)
meta_title: string
meta_description: string
target_keyword: string (required)
secondary_keywords: string[] (optional)
```

**12 Rules với trọng số (Chain of Responsibility pattern):**

| Rule ID             | Tên                                                   | Weight | Logic                       |
| ------------------- | ----------------------------------------------------- | ------ | --------------------------- |
| `keyword_density`   | Mật độ keyword 1-2%                                   | 10%    | Count keyword / total words |
| `title_keyword`     | Title chứa keyword (50 char đầu)                      | 10%    | regex match                 |
| `meta_description`  | Meta desc 140-160 ký tự + chứa keyword                | 8%     | length check                |
| `h1_unique`         | H1 unique + chứa keyword                              | 8%     | parse HTML                  |
| `heading_structure` | ≥3 H2, H3 đúng cấu trúc                               | 8%     | parse HTML                  |
| `word_count`        | Word count theo intent (info ≥1500, commercial ≥2000) | 10%    | count words                 |
| `links`             | ≥3 internal + ≥2 external                             | 8%     | parse `<a>`                 |
| `images_alt`        | ≥3 ảnh, 100% có alt                                   | 8%     | parse `<img>`               |
| `schema_markup`     | Có FAQ/Article schema JSON-LD                         | 7%     | regex check                 |
| `lsi_keywords`      | ≥10 LSI keyword                                       | 8%     | AI semantic check           |
| `intro_hook`        | Intro 150 từ đầu chứa keyword                         | 7%     | first 150 words analysis    |
| `faq_section`       | ≥5 câu FAQ                                            | 8%     | detect FAQ structure        |

**Tổng điểm = weighted average của 12 rule scores**

**Interface:**

```typescript
interface ScoringRule {
  id: string;
  name: string;
  weight: number;
  evaluate(article: ArticleInput): RuleResult;
}

interface RuleResult {
  rule_id: string;
  name: string;
  score: number; // 0-100
  weight: number;
  status: 'good' | 'warning' | 'fail';
  message: string;
  suggestions: { text: string; action: 'manual' | 'auto-fixable' }[];
}
```

**Auto-fix endpoint:** `POST /api/v1/audit/auto-fix` — dùng AI fix các rule <80

**Acceptance:**

- Score 1 bài <5s
- Realtime update mỗi 5s trong editor không lag
- Correlation với ranking thực tế ≥0.6
- Gợi ý fix actionable 100% cho rule <80

---

### TN8: WordPress Auto Publisher

**Endpoints:**

```
POST /api/v1/publisher/sites              # connect site mới
POST /api/v1/publisher/sites/:id/test     # test connection
POST /api/v1/publisher/wordpress          # publish bài
POST /api/v1/publisher/bulk               # bulk publish
```

**Connect site request:**

```yaml
url: string (required)
username: string (required)
application_password: string (required) # encrypt AES-256-GCM
name: string (optional)
```

**Publish request:**

```yaml
article_id: string (required)
site_id: string (required)
status: 'draft'|'publish'|'future' (default 'publish')
scheduled_at: timestamp (required nếu status='future')
categories: string[] (optional, auto match taxonomy)
tags: string[] (optional)
featured_image_id: string (optional)
```

**Adapter Pattern (cho Phase 2 mở rộng):**

```typescript
interface PublisherAdapter {
  type: string; // 'wordpress', 'shopify', 'haravan'
  testConnection(credentials: any): Promise<boolean>;
  detectPlugins?(credentials: any): Promise<string[]>;
  publish(article: Article, credentials: any, options: PublishOptions): Promise<PublishResult>;
}
```

**WordPress Adapter Logic:**

1. Auth: Basic Auth với Application Password (WP 5.6+)
2. API endpoint: `POST {site_url}/wp-json/wp/v2/posts`
3. Upload featured image trước qua `/media`, lấy `media_id`
4. Map categories/tags → IDs (tạo mới nếu chưa có)
5. Auto-detect plugin SEO (Yoast/RankMath/SEOPress) qua `/wp-json`
6. Fill meta fields đúng theo plugin đã detect:
   - Yoast: `_yoast_wpseo_title`, `_yoast_wpseo_metadesc`
   - RankMath: `rank_math_title`, `rank_math_description`
   - SEOPress: tương tự
7. Inject schema markup JSON-LD vào content
8. Push job vào BullMQ với retry 3 lần (exponential backoff 2s/4s/8s)

**Scheduled posting:** Dùng WP native scheduling (`status='future'` + `date`), bài tự publish kể cả khi MKT SEO AI offline.

**Bulk publish:** Rate limit 10 bài/site/giờ, random delay 2-15s giữa các lần publish.

**Acceptance:**

- Connect site <60s
- Publish bài (có ảnh + schema + meta) <10s
- 1 user ≥10 site
- Error rate <1% trên 1000 publish job
- Schedule sai số <30s
- Auto-detect SEO plugin ≥95%

---

## 9. Authentication & Authorization

### JWT Flow

```
1. Register → email verify (link qua SendGrid)
2. Login → { access_token (15min), refresh_token (30 days) }
3. Mọi API request: Authorization: Bearer <access_token>
4. Access token hết hạn → POST /auth/refresh
5. Logout → invalidate refresh_token (Redis blacklist)
```

### JWT Payload

```json
{
  "sub": "user_uuid",
  "email": "...",
  "plan": "pro",
  "role": "user",
  "iat": 1716624000,
  "exp": 1716624900,
  "jti": "unique_token_id"
}
```

### RBAC Decorators

```typescript
@Roles('admin')                    // Chỉ admin
@RequirePlan('pro', 'agency')      // Chỉ Pro+ và Agency
@RequireFeature('brand_voice')     // Feature theo plan
@RequireQuota('articles', 1)       // Check quota trước
@RequireScope('content:write')     // API key scope
```

---

## 10. Rate Limiting & Quota

### Rate Limit (theo user, Redis-backed)

| Endpoint group   | Free    | Starter  | Pro      | Agency    |
| ---------------- | ------- | -------- | -------- | --------- |
| Auth             | 10/phút | 10/phút  | 10/phút  | 10/phút   |
| AI generation    | 5/giờ   | 30/giờ   | 100/giờ  | 500/giờ   |
| Keyword research | 10/giờ  | 50/giờ   | 200/giờ  | 1000/giờ  |
| Publish          | 5/giờ   | 50/ngày  | 300/ngày | unlimited |
| General read     | 60/phút | 300/phút | 600/phút | 1200/phút |

### Quota (theo plan, reset hàng tháng)

| Resource       | Trial | Starter | Pro   | Agency    | Lifetime |
| -------------- | ----- | ------- | ----- | --------- | -------- |
| Articles/tháng | 5     | 30      | 150   | unlimited | 150      |
| Keywords/tháng | 100   | 200     | 1.000 | 5.000     | 1.000    |
| WP Sites       | 1     | 1       | 5     | 20        | 5        |
| Brand Voices   | 1     | 2       | 5     | unlimited | 5        |
| Images/tháng   | 20    | 100     | 500   | unlimited | 500      |
| API Keys       | 0     | 0       | 2     | 10        | 2        |

---

## 11. Error Codes

```typescript
enum ErrorCode {
  // Auth
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Resources
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',

  // Quota & Rate Limit
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RATE_LIMITED = 'RATE_LIMITED',
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',

  // External APIs
  AI_PROVIDER_ERROR = 'AI_PROVIDER_ERROR',
  AI_PROVIDER_TIMEOUT = 'AI_PROVIDER_TIMEOUT',
  WP_CONNECTION_ERROR = 'WP_CONNECTION_ERROR',
  WP_AUTH_ERROR = 'WP_AUTH_ERROR',

  // Internal
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  QUEUE_ERROR = 'QUEUE_ERROR',
}
```

---

## 12. Plugin System (Phase 2 Ready)

> MVP chưa cần plugin marketplace nhưng kiến trúc phải sẵn sàng.

### Interface

```typescript
interface MktSeoPlugin {
  metadata: {
    slug: string;
    name: string;
    version: string;
    description: string;
    author: string;
  };
  onActivate?(userId: string, config: any): Promise<void>;
  onDeactivate?(userId: string): Promise<void>;
  capabilities: {
    keywordSources?: KeywordSourceProvider[];
    aiProviders?: AIProvider[];
    publisherAdapters?: PublisherAdapter[];
    auditRules?: ScoringRule[];
    eventListeners?: EventListener[];
  };
}
```

### Extensible Points

| Point              | MVP               | Phase 2                             |
| ------------------ | ----------------- | ----------------------------------- |
| Keyword Sources    | Google, Bing, PAA | YouTube, TikTok, Shopee, Reddit     |
| AI Providers       | Claude, GPT       | Gemini, Llama, custom               |
| Publisher Adapters | WordPress         | Shopify, Haravan, Sapo, Webflow     |
| Audit Rules        | 12 rules          | SGE rules, brand safety, plagiarism |
| Content Formats    | 8 format          | Email, Twitter, LinkedIn            |
| Image Models       | Flux, DALL-E      | Midjourney, SD self-host            |

### Cách thêm Publisher mới (vd Shopify Phase 2)

```typescript
// Bước 1: Implement adapter
@Injectable()
export class ShopifyAdapter implements PublisherAdapter {
  type = 'shopify';
  async testConnection(creds) { ... }
  async publish(article, creds, opts) { ... }
}

// Bước 2: Register vào PublisherModule
@Module({
  providers: [
    WordPressAdapter,
    ShopifyAdapter,  // ← chỉ thêm dòng này
    {
      provide: 'PUBLISHER_ADAPTERS',
      useFactory: (wp, shopify) => [wp, shopify],
      inject: [WordPressAdapter, ShopifyAdapter]
    }
  ]
})

// Bước 3: Không cần migration vì sites.type đã là VARCHAR(20)
// Bước 4: Thêm UI form connect Shopify, không đụng core
```

### Event Bus (Loose Coupling)

```typescript
// Emit event
this.eventBus.emit('article.completed', { article_id, user_id });

// Subscribe trong module khác
@OnEvent('article.completed')
async handleArticleCompleted(payload) {
  // webhook dispatch, billing usage update, etc.
}
```

---

## 13. Environment Variables

```env
NODE_ENV=development
PORT=3005                                            # API
WEB_PORT=3006                                        # Web

# Application URLs (placeholder - cập nhật khi chốt domain)
APP_URL=http://localhost:3006
API_URL=http://localhost:3005
PUBLIC_APP_NAME="MKT SEO AI"

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mkt_seo_dev
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=                                          # openssl rand -hex 32
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# CORS
CORS_ORIGINS=http://localhost:3006

# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...

# External APIs
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
BRIGHTDATA_USERNAME=...
BRIGHTDATA_PASSWORD=...
TINYPNG_API_KEY=...

# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=mkt-seo-images-dev
R2_PUBLIC_URL=                                       # Để trống local (signed URL); chốt CDN sau

# Payment
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SEPAY_API_KEY=...

# Notifications
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=noreply@example.com              # Cập nhật khi chốt domain
TELEGRAM_BOT_TOKEN=...

# Monitoring
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
```

> **Khi chốt domain:** Update `APP_URL`, `API_URL`, `CORS_ORIGINS`, `R2_PUBLIC_URL`, `SENDGRID_FROM_EMAIL` trong `.env.staging` và `.env.production`.

---

## 14. Deployment

### Docker Compose (dev)

```yaml
services:
  api:
    build: .
    ports: ['3005:3005']
    depends_on: [postgres, redis]
    env_file: .env

  postgres:
    image: postgres:16
    volumes: ['./data/postgres:/var/lib/postgresql/data']
    environment:
      POSTGRES_DB: mkt_seo_dev

  redis:
    image: redis:7-alpine
    volumes: ['./data/redis:/data']
```

### Dockerfile (production)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3005
CMD ["node", "dist/main"]
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/main.yml
on:
  pull_request:
  push:
    branches: [main, staging]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run build

  deploy-staging:
    if: github.ref == 'refs/heads/staging'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - deploy to DigitalOcean App Platform
      - run migrations
      - smoke test

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: test
    environment: production # Requires approval
    steps:
      - backup DB
      - deploy to production
      - run migrations
      - smoke test
```

---

## 15. Coding Standards

### TypeScript

- `strict: true` trong tsconfig
- Không dùng `any`, dùng `unknown` nếu cần
- Interfaces cho public API, types cho internal
- `PascalCase` cho class/interface, `camelCase` cho variable/function

### Style

- Prettier + ESLint configured
- Pre-commit hook (husky + lint-staged)
- Max line length 100, 2 spaces indent
- No unused imports

### Git Workflow

```
main (production)
  ├── staging (auto-deploy staging)
  │     ├── feature/<name>
  │     └── fix/<name>
  └── hotfix/<name>
```

**Conventional Commits:**

```
feat(keywords): add Bing Suggest source
fix(wp): retry publish on 503 error
docs(api): update OpenAPI spec
refactor(audit): extract scoring rules
test(brand-voice): add integration tests
```

### Definition of Done (mỗi tính năng)

- [ ] Unit test coverage ≥80%
- [ ] Integration test happy + error paths
- [ ] API documented in Swagger
- [ ] Frontend implemented và connected
- [ ] E2E test main user flow
- [ ] Performance: API p95 <2s (non-AI), <90s (AI)
- [ ] Error handling: tất cả error có error code, message tiếng Việt
- [ ] Logging: business events qua Pino
- [ ] Sentry tracking enabled
- [ ] Code review approved
- [ ] Deployed staging, QA pass
- [ ] PRD acceptance criteria 100% pass

---

## 16. Logging

```typescript
// Pino structured logging
this.logger.info(
  {
    event: 'article.generated',
    user_id: userId,
    article_id: articleId,
    word_count: wordCount,
    duration_ms: duration,
    ai_cost_usd: cost,
  },
  'Article generated successfully',
);
```

**Log levels:**

- `error`: cần action ngay (DB down, API key invalid)
- `warn`: cần chú ý (retry success, quota gần hết)
- `info`: business event quan trọng (article created, publish success)
- `debug`: chi tiết kỹ thuật (chỉ dev)

---

## 17. Security

- **Credentials encryption:** AES-256-GCM cho WP application_password, master key xoay 90 ngày
- **Auth:** JWT + refresh token, MFA cho Pro+
- **Rate limiting:** theo plan tier
- **Data backup:** PostgreSQL backup hằng giờ, restore point 30 ngày
- **GDPR-ready:** user export + xóa data
- **Audit trail:** action quan trọng log 1 năm
- **HTTPS only** trong production
- **HSTS** qua Cloudflare
- **Input validation:** class-validator + Zod
- **SQL injection:** dùng Prisma (parameterized queries)
- **XSS:** sanitize HTML content qua DOMPurify
- **CSRF:** SameSite cookies + CSRF token cho state-changing requests

---

**END OF SPECIFICATION**
