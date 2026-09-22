ALTER TYPE "Status" ADD VALUE IF NOT EXISTS 'PROCESSING';

CREATE TABLE IF NOT EXISTS "background_jobs" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "Status" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "background_jobs_status_run_at_idx"
  ON "background_jobs" ("status", "run_at");

CREATE INDEX IF NOT EXISTS "background_jobs_status_locked_at_idx"
  ON "background_jobs" ("status", "locked_at");
