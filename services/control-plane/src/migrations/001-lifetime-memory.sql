-- Lifetime Personal Memory Schema
-- Run once against the Postgres instance.
-- Safe to re-run (all statements use IF NOT EXISTS / CREATE OR REPLACE).

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Partitioned memories table ───────────────────────────────────────────────
-- Partitioned by year so queries can prune to recent partitions.
-- Supports 30 years of data without a single monolithic table.
CREATE TABLE IF NOT EXISTS memories (
  id            TEXT          NOT NULL,
  content       TEXT          NOT NULL,
  source        TEXT          NOT NULL,  -- chat|email|whatsapp|telegram|calendar|note|document|strava|garmin|clickup
  source_id     TEXT,                    -- external ID for idempotent upsert
  type          TEXT          NOT NULL DEFAULT '',
  tags          TEXT[]        NOT NULL DEFAULT '{}',
  metadata      JSONB         NOT NULL DEFAULT '{}',
  embedding     vector(384),             -- all-MiniLM-L6-v2, populated async by pipeline
  embedding_at  TIMESTAMPTZ,             -- NULL = pending embedding job
  tsv           TSVECTOR,                -- auto-updated by trigger, GIN-indexed
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Yearly partitions 2010-2035
DO $$
DECLARE
  y INTEGER;
BEGIN
  FOR y IN 2010..2035 LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS memories_%s PARTITION OF memories
       FOR VALUES FROM (''%s-01-01'') TO (''%s-01-01'')',
      y, y, y + 1
    );
  END LOOP;
END;
$$;

-- Default partition for anything outside the range
CREATE TABLE IF NOT EXISTS memories_default PARTITION OF memories DEFAULT;

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS memories_tsv_gin
  ON memories USING GIN (tsv);

-- HNSW index for approximate nearest neighbour vector search
-- m=16, ef_construction=64: good recall/speed for 100k-10M vectors
CREATE INDEX IF NOT EXISTS memories_embedding_hnsw
  ON memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Source lookup for idempotent upserts
CREATE INDEX IF NOT EXISTS memories_source_idx
  ON memories (source, source_id)
  WHERE source_id IS NOT NULL;

-- Pending embedding backfill scan
CREATE INDEX IF NOT EXISTS memories_pending_embed
  ON memories (created_at)
  WHERE embedding IS NULL;

-- ── tsvector auto-update trigger ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION memories_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS memories_tsv_trigger ON memories;
CREATE TRIGGER memories_tsv_trigger
  BEFORE INSERT OR UPDATE OF content ON memories
  FOR EACH ROW EXECUTE FUNCTION memories_tsv_update();

-- ── Pinned facts table ───────────────────────────────────────────────────────
-- Direct key-value lookup for identity queries ("what is my name?" → user.name).
-- Always returned first — no vector search overhead.
CREATE TABLE IF NOT EXISTS memory_facts (
  key         TEXT          PRIMARY KEY,   -- 'user.name' | 'user.birthday' | 'user.company'
  value       TEXT          NOT NULL,
  source      TEXT          NOT NULL,       -- 'onboarding' | 'chat' | 'ingest'
  confidence  FLOAT         NOT NULL DEFAULT 1.0,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Health / fitness time-series ─────────────────────────────────────────────
-- NOT vector-indexed. Queried with SQL aggregates (AVG by month, trend over years).
CREATE TABLE IF NOT EXISTS health_metrics (
  id            TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source        TEXT            NOT NULL,   -- garmin|strava|apple_health|manual
  metric_type   TEXT            NOT NULL,   -- heart_rate|steps|sleep_hours|hrv|vo2max|weight|calories
  value         DOUBLE PRECISION NOT NULL,
  unit          TEXT            NOT NULL DEFAULT '',
  activity_type TEXT,                        -- run|cycle|swim|rest|NULL
  recorded_at   TIMESTAMPTZ     NOT NULL,
  metadata      JSONB           NOT NULL DEFAULT '{}',
  source_id     TEXT,                        -- external ID for idempotent upsert
  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS health_metrics_time
  ON health_metrics (metric_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS health_metrics_source
  ON health_metrics (source, source_id)
  WHERE source_id IS NOT NULL;

-- ── Embedding pipeline queue ─────────────────────────────────────────────────
-- Postgres-backed durable queue. No BullMQ needed.
-- Worker uses FOR UPDATE SKIP LOCKED for concurrent-safe claiming.
CREATE TABLE IF NOT EXISTS embedding_jobs (
  id          BIGSERIAL     PRIMARY KEY,
  memory_id   TEXT          NOT NULL,
  priority    SMALLINT      NOT NULL DEFAULT 5,  -- 1=urgent (chat turn), 5=normal, 10=backfill
  status      TEXT          NOT NULL DEFAULT 'pending', -- pending|processing|done|failed
  attempts    SMALLINT      NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  claimed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS embedding_jobs_pending
  ON embedding_jobs (priority, id)
  WHERE status = 'pending';

-- ── Consolidation tracking ───────────────────────────────────────────────────
-- Prevent re-processing already-checked near-duplicate pairs.
CREATE TABLE IF NOT EXISTS memory_consolidations (
  memory_id     TEXT          PRIMARY KEY,
  merged_into   TEXT,                        -- NULL = kept, ref = was merged away
  checked_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Seed pinned facts from environment (idempotent) ──────────────────────────
-- These will be overwritten by onboarding if user profile data is richer.
INSERT INTO memory_facts (key, value, source, confidence)
VALUES
  ('user.system', 'open-greg personal AI assistant', 'system', 1.0)
ON CONFLICT (key) DO NOTHING;
