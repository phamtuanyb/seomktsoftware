-- CreateTable
CREATE TABLE "pipeline_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "input_json" JSONB NOT NULL,
    "steps_json" JSONB NOT NULL DEFAULT '[]',
    "outline_id" UUID,
    "article_id" UUID,
    "publish_job_id" UUID,
    "error_message" TEXT,
    "started_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_pipeline_runs_user" ON "pipeline_runs"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
