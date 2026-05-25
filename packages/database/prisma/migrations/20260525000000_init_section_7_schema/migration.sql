-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "phone" VARCHAR(20),
    "avatar_url" TEXT,
    "role" VARCHAR(20) NOT NULL DEFAULT 'user',
    "email_verified_at" TIMESTAMP(6),
    "preferences_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plan" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMP(6) NOT NULL,
    "expires_at" TIMESTAMP(6),
    "stripe_subscription_id" VARCHAR(255),
    "sepay_payment_id" VARCHAR(255),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "period" VARCHAR(20) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "limit_value" INTEGER NOT NULL,
    "reset_at" TIMESTAMP(6),

    CONSTRAINT "quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100),
    "key_hash" VARCHAR(255) NOT NULL,
    "prefix" VARCHAR(10) NOT NULL,
    "scopes" TEXT[],
    "last_used_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(6),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "seed_keyword" VARCHAR(255),
    "language" VARCHAR(10) NOT NULL DEFAULT 'vi',
    "country" VARCHAR(10) NOT NULL DEFAULT 'VN',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "keyword_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keywords" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "project_id" UUID,
    "keyword" VARCHAR(500) NOT NULL,
    "source" VARCHAR(50),
    "volume" INTEGER,
    "keyword_difficulty" INTEGER,
    "cpc" DECIMAL(10,2),
    "intent" VARCHAR(20),
    "intent_confidence" DECIMAL(3,2),
    "metadata_json" JSONB,
    "analyzed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_voices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "profile_json" JSONB NOT NULL,
    "reference_articles" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "trained_at" TIMESTAMP(6) NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "brand_voices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "slug" VARCHAR(500),
    "content" TEXT,
    "content_markdown" TEXT,
    "excerpt" TEXT,
    "meta_title" VARCHAR(255),
    "meta_description" VARCHAR(500),
    "target_keyword" VARCHAR(255),
    "secondary_keywords" TEXT[],
    "outline_json" JSONB,
    "format" VARCHAR(50),
    "word_count" INTEGER,
    "content_score" INTEGER,
    "score_breakdown_json" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "brand_voice_id" UUID,
    "featured_image_id" UUID,
    "ai_model_used" VARCHAR(50),
    "ai_cost_usd" DECIMAL(10,4),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "article_id" UUID,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "prompt" TEXT,
    "alt_text" VARCHAR(500),
    "style" VARCHAR(50),
    "aspect_ratio" VARCHAR(20),
    "width" INTEGER,
    "height" INTEGER,
    "file_size_bytes" INTEGER,
    "model_used" VARCHAR(50),
    "cost_usd" DECIMAL(10,4),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'wordpress',
    "username" VARCHAR(255),
    "credentials_encrypted" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "plugin_seo_detected" VARCHAR(50),
    "metadata_json" JSONB,
    "last_check_at" TIMESTAMP(6),
    "last_publish_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "scheduled_at" TIMESTAMP(6),
    "started_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "wp_post_id" INTEGER,
    "published_url" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "error_code" VARCHAR(50),
    "payload_json" JSONB,
    "response_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publish_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "webhook_id" UUID NOT NULL,
    "event" VARCHAR(100) NOT NULL,
    "payload_json" JSONB NOT NULL,
    "response_status" INTEGER,
    "response_body" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "delivered_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50),
    "resource_id" UUID,
    "ip_address" INET,
    "user_agent" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "author" VARCHAR(255),
    "is_official" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "config_json" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_plugin_installs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plugin_id" UUID NOT NULL,
    "config_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "installed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_plugin_installs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quotas_user_id_resource_period_key" ON "quotas"("user_id", "resource", "period");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "keyword_projects_user_id_idx" ON "keyword_projects"("user_id");

-- CreateIndex
CREATE INDEX "idx_keywords_user_project" ON "keywords"("user_id", "project_id");

-- CreateIndex
CREATE INDEX "idx_brand_voices_user" ON "brand_voices"("user_id");

-- CreateIndex
CREATE INDEX "idx_articles_user_status" ON "articles"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_articles_created" ON "articles"("created_at" DESC);

-- CreateIndex
CREATE INDEX "images_user_id_idx" ON "images"("user_id");

-- CreateIndex
CREATE INDEX "idx_sites_user" ON "sites"("user_id");

-- CreateIndex
CREATE INDEX "idx_publish_jobs_status_scheduled" ON "publish_jobs"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "idx_publish_jobs_user" ON "publish_jobs"("user_id");

-- CreateIndex
CREATE INDEX "webhooks_user_id_idx" ON "webhooks"("user_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_created_at_idx" ON "webhook_deliveries"("webhook_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user_action" ON "audit_logs"("user_id", "action", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "plugins_slug_key" ON "plugins"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_plugin_installs_user_id_plugin_id_key" ON "user_plugin_installs"("user_id", "plugin_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotas" ADD CONSTRAINT "quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_projects" ADD CONSTRAINT "keyword_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "keyword_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_voices" ADD CONSTRAINT "brand_voices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_brand_voice_id_fkey" FOREIGN KEY ("brand_voice_id") REFERENCES "brand_voices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plugin_installs" ADD CONSTRAINT "user_plugin_installs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plugin_installs" ADD CONSTRAINT "user_plugin_installs_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

