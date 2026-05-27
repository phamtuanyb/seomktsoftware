CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" VARCHAR(100) NOT NULL UNIQUE,
  "value_json" JSONB,
  "encrypted_value" TEXT,
  "updated_by" UUID,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_app_settings_key" ON "app_settings" ("key");
