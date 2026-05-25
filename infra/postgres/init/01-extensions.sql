-- Postgres extensions used by the schema (Section 7).
-- pgcrypto: gen_random_uuid (fallback when app does not generate UUID v7)
-- pg_trgm:  trigram indexes for keyword fuzzy search (TN1/TN2)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
