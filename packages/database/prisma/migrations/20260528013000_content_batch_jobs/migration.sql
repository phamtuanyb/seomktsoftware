CREATE TABLE "content_batch_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mode" VARCHAR(30) NOT NULL DEFAULT 'keyword_list',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "config_json" JSONB NOT NULL,
    "error_message" TEXT,
    "started_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_batch_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_batch_job_items" (
    "id" UUID NOT NULL,
    "batch_job_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "keyword" VARCHAR(255) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "input_outline_json" JSONB,
    "generated_outline_json" JSONB,
    "article_id" UUID,
    "error_message" TEXT,
    "started_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_batch_job_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_content_batch_jobs_user" ON "content_batch_jobs"("user_id", "created_at" DESC);
CREATE INDEX "idx_content_batch_jobs_status" ON "content_batch_jobs"("status");
CREATE UNIQUE INDEX "uq_content_batch_job_items_order" ON "content_batch_job_items"("batch_job_id", "order_index");
CREATE INDEX "idx_content_batch_job_items_job_status" ON "content_batch_job_items"("batch_job_id", "status");

ALTER TABLE "content_batch_jobs"
ADD CONSTRAINT "content_batch_jobs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_batch_job_items"
ADD CONSTRAINT "content_batch_job_items_batch_job_id_fkey"
FOREIGN KEY ("batch_job_id") REFERENCES "content_batch_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_batch_job_items"
ADD CONSTRAINT "content_batch_job_items_article_id_fkey"
FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
