import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const g = globalThis as unknown as { __sql?: Sql; __schema?: Promise<void> };

function client(): Sql {
  if (!g.__sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
    g.__sql = postgres(url, {
      max: 5,
      idle_timeout: 20,
      prepare: false, // Neon/pgbouncer pooled connection 호환
      onnotice: () => {},
    });
  }
  return g.__sql;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  failed_count  INT  NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id          SERIAL PRIMARY KEY,
  emp_no      TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  shift_type  TEXT NOT NULL DEFAULT '',
  department  TEXT NOT NULL DEFAULT '',
  work_group  TEXT NOT NULL DEFAULT '',
  position    TEXT NOT NULL DEFAULT '',
  qr_token    TEXT UNIQUE NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emp_name ON employees(name);
CREATE INDEX IF NOT EXISTS idx_emp_dept ON employees(department);

CREATE TABLE IF NOT EXISTS trainings (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rounds (
  id          SERIAL PRIMARY KEY,
  training_id INT NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  round_no    INT NOT NULL,
  edu_date    DATE NOT NULL,
  start_time  TEXT NOT NULL DEFAULT '',
  end_time    TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  instructor  TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('ready','open','closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (training_id, round_no)
);

CREATE TABLE IF NOT EXISTS attendance (
  id          SERIAL PRIMARY KEY,
  training_id INT NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  round_id    INT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_by  INT REFERENCES admins(id) ON DELETE SET NULL,
  method      TEXT NOT NULL DEFAULT 'qr' CHECK (method IN ('qr','manual')),
  UNIQUE (training_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_att_round ON attendance(round_id);
CREATE INDEX IF NOT EXISTS idx_att_time ON attendance(training_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  admin_id   INT REFERENCES admins(id) ON DELETE SET NULL,
  username   TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  ip         TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at DESC);

-- v2: 주간 공용 QR 자가출석
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS ip TEXT NOT NULL DEFAULT '';
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_method_check;
CREATE INDEX IF NOT EXISTS idx_att_device ON attendance(training_id, device_id);
CREATE INDEX IF NOT EXISTS idx_audit_ip ON audit_logs(ip, action, created_at DESC);

-- v2: 교육 자료 파일
CREATE TABLE IF NOT EXISTS training_files (
  id          SERIAL PRIMARY KEY,
  training_id INT NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  mime        TEXT NOT NULL DEFAULT 'application/octet-stream',
  size        INT  NOT NULL,
  data        BYTEA NOT NULL,
  uploaded_by INT REFERENCES admins(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_files_training ON training_files(training_id);

-- v2: 사이트 설정 (로고, 회사명, 주간 QR 버전)
-- v2.2: 관리감독자 (법정 교육 이수 면제 → 항상 출석 인정)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_supervisor BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/** 스키마를 보장한 뒤 SQL 클라이언트를 반환 (프로세스당 1회 마이그레이션) */
export async function db(): Promise<Sql> {
  const sql = client();
  if (!g.__schema) {
    g.__schema = sql
      .begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(872001)`;
        await tx.unsafe(SCHEMA);
      })
      .then(() => undefined)
      .catch((e) => {
        g.__schema = undefined;
        throw e;
      });
  }
  await g.__schema;
  return sql;
}

export type { Sql };
