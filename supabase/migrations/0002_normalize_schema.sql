-- 정규화 1단계: 신규 테이블(스키마)만 추가 (additive, 기존 앱 동작에 영향 없음)
-- trips.data(jsonb) 통짜 저장 구조를 엔티티별 테이블로 분리한다. data 컬럼은 이 마이그레이션에서 건드리지 않는다.
-- trips에 추가하는 신규 컬럼은 기존 행이 있으므로 일단 nullable로 추가하고,
-- 0003_migrate_data.sql에서 백필 후 NOT NULL로 전환한다.

ALTER TABLE app_travel_plan.trips
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS is_international boolean;

-- ────────────────────────────────────────────
-- schedule_items — DaySchedule은 자체 필드가 date뿐이라 별도 테이블 없이 day_date로 흡수.
-- position은 배열 순서 보존용 내부 컬럼(앱 타입에는 노출하지 않음).
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_travel_plan.schedule_items (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES app_travel_plan.trips (id) ON DELETE CASCADE,
  day_date date NOT NULL,
  position integer NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('attraction', 'restaurant', 'hotel', 'transport')),
  title text NOT NULL,
  time text,
  duration integer,
  location_name text,
  location_lat double precision,
  location_lng double precision,
  location_address text,
  from_location_name text,
  from_location_lat double precision,
  from_location_lng double precision,
  from_location_address text,
  transport_to_next text CHECK (transport_to_next IN ('walk', 'public', 'car', 'taxi', 'flight')),
  notes text,
  price numeric,
  currency text,
  meal_type text CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  reservation_needed boolean,
  check_type text CHECK (check_type IN ('checkin', 'checkout')),
  transport_mode text CHECK (transport_mode IN ('walk', 'public', 'car', 'taxi', 'flight'))
);

CREATE INDEX IF NOT EXISTS schedule_items_trip_id_idx ON app_travel_plan.schedule_items (trip_id);

-- ────────────────────────────────────────────
-- flights
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_travel_plan.flights (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES app_travel_plan.trips (id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  airline text NOT NULL,
  flight_number text NOT NULL,
  departure_airport text NOT NULL,
  departure_date date NOT NULL,
  departure_time text NOT NULL,
  arrival_airport text NOT NULL,
  arrival_date date NOT NULL,
  arrival_time text NOT NULL,
  booking_ref text,
  seat text,
  price_krw integer
);

CREATE INDEX IF NOT EXISTS flights_trip_id_idx ON app_travel_plan.flights (trip_id);

-- ────────────────────────────────────────────
-- accommodations
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_travel_plan.accommodations (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES app_travel_plan.trips (id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  check_in_date date NOT NULL,
  check_in_time text,
  check_out_date date NOT NULL,
  check_out_time text,
  booking_platform text,
  booking_ref text,
  phone text,
  price_krw integer
);

CREATE INDEX IF NOT EXISTS accommodations_trip_id_idx ON app_travel_plan.accommodations (trip_id);

-- ────────────────────────────────────────────
-- budgets — trip과 1:1. 별도 테이블로 두어 "사용자가 예산 탭을 아예 안 건드림"(budget === undefined)을
-- "행이 없음"으로 정확히 표현한다. surrogate id 없이 trip_id를 그대로 PK로 사용.
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_travel_plan.budgets (
  trip_id uuid PRIMARY KEY REFERENCES app_travel_plan.trips (id) ON DELETE CASCADE,
  local_currency text NOT NULL,
  exchange_rate numeric NOT NULL
);

-- ────────────────────────────────────────────
-- budget_items — budgets를 경유하지 않고 trips.id에 직접 FK
-- (앱에서 budget과 budget_items는 항상 같은 저장 호출에서 함께 쓰임)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_travel_plan.budget_items (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES app_travel_plan.trips (id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('flight', 'hotel', 'food', 'transport', 'activity', 'shopping', 'etc')),
  label text,
  planned_krw integer NOT NULL
);

CREATE INDEX IF NOT EXISTS budget_items_trip_id_idx ON app_travel_plan.budget_items (trip_id);

-- ────────────────────────────────────────────
-- reports
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_travel_plan.reports (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES app_travel_plan.trips (id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('draft', 'completed')),
  user_notes text NOT NULL DEFAULT '',
  ai_generated_text text NOT NULL DEFAULT '',
  schedule_summary text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS reports_trip_id_idx ON app_travel_plan.reports (trip_id);

-- ────────────────────────────────────────────
-- report_day_texts — aiDayTexts(Record<dayIndex,string>) 정규화.
-- report_id 외에 trip_id도 중복 저장해 RLS/조회를 나머지 테이블과 동일한 1-hop 패턴으로 통일한다.
-- 쓰기는 항상 upsert_trip RPC 한 곳에서만 일어나므로 동기화 리스크 없음.
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_travel_plan.report_day_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES app_travel_plan.reports (id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES app_travel_plan.trips (id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  text text NOT NULL,
  UNIQUE (report_id, day_index)
);

CREATE INDEX IF NOT EXISTS report_day_texts_trip_id_idx ON app_travel_plan.report_day_texts (trip_id);
CREATE INDEX IF NOT EXISTS report_day_texts_report_id_idx ON app_travel_plan.report_day_texts (report_id);

-- ────────────────────────────────────────────
-- report_photos — ReportPhotoMeta. id는 클라이언트가 생성해 Storage 경로에도 쓰는 값이라
-- 서버에서 새로 발급하지 않고 그대로 저장한다. `order`는 예약어라 컬럼명은 position.
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_travel_plan.report_photos (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES app_travel_plan.reports (id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES app_travel_plan.trips (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  day_index integer NOT NULL,
  position integer NOT NULL DEFAULT 0,
  comment text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS report_photos_trip_id_idx ON app_travel_plan.report_photos (trip_id);
CREATE INDEX IF NOT EXISTS report_photos_report_id_idx ON app_travel_plan.report_photos (report_id);

-- ────────────────────────────────────────────
-- 권한 부여 (0001의 GRANT ALL ON TABLES 관용구를 신규 테이블에도 명시적으로 재적용)
-- ────────────────────────────────────────────
GRANT ALL ON ALL TABLES IN SCHEMA app_travel_plan TO anon, authenticated;

-- ────────────────────────────────────────────
-- RLS — 모든 자식 테이블에 동일한 관용구: trip_id가 내 소유 trip에 속하는지 검사.
-- (EXISTS 상관 서브쿼리 대신 비상관 IN 서브쿼리 사용 — Supabase RLS 성능 가이드 권장 패턴)
-- ────────────────────────────────────────────
ALTER TABLE app_travel_plan.schedule_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own rows" ON app_travel_plan.schedule_items;
CREATE POLICY "Users own rows" ON app_travel_plan.schedule_items
  FOR ALL USING (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()));

ALTER TABLE app_travel_plan.flights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own rows" ON app_travel_plan.flights;
CREATE POLICY "Users own rows" ON app_travel_plan.flights
  FOR ALL USING (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()));

ALTER TABLE app_travel_plan.accommodations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own rows" ON app_travel_plan.accommodations;
CREATE POLICY "Users own rows" ON app_travel_plan.accommodations
  FOR ALL USING (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()));

ALTER TABLE app_travel_plan.budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own rows" ON app_travel_plan.budgets;
CREATE POLICY "Users own rows" ON app_travel_plan.budgets
  FOR ALL USING (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()));

ALTER TABLE app_travel_plan.budget_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own rows" ON app_travel_plan.budget_items;
CREATE POLICY "Users own rows" ON app_travel_plan.budget_items
  FOR ALL USING (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()));

ALTER TABLE app_travel_plan.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own rows" ON app_travel_plan.reports;
CREATE POLICY "Users own rows" ON app_travel_plan.reports
  FOR ALL USING (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()));

ALTER TABLE app_travel_plan.report_day_texts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own rows" ON app_travel_plan.report_day_texts;
CREATE POLICY "Users own rows" ON app_travel_plan.report_day_texts
  FOR ALL USING (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()));

ALTER TABLE app_travel_plan.report_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own rows" ON app_travel_plan.report_photos;
CREATE POLICY "Users own rows" ON app_travel_plan.report_photos
  FOR ALL USING (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM app_travel_plan.trips WHERE user_id = auth.uid()));
