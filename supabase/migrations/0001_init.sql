-- travel-plan 전용 스키마 (기존 운영 DB의 현재 구조를 코드/README 기준으로 역추적해 기록한 baseline)
-- 스키마명은 프로젝트 자체 컨벤션(docs/PROJECT_TEMPLATE.md)에 따라 app_ 접두사를 사용한다.
-- ~/.claude/CLAUDE.md 3.1 스키마 분리 원칙 참고.
--
-- 주의: 이 파일은 이미 운영 중인 Supabase 프로젝트의 스키마를 문서화하기 위한 baseline이다.
-- 실제로 적용하기 전에 대시보드의 현재 스키마와 반드시 비교해 차이가 없는지 확인할 것
-- (CREATE ... IF NOT EXISTS / ON CONFLICT DO NOTHING으로 재실행해도 안전하게 작성됨).
CREATE SCHEMA IF NOT EXISTS app_travel_plan;

GRANT USAGE ON SCHEMA app_travel_plan TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA app_travel_plan TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_travel_plan
  GRANT ALL ON TABLES TO anon, authenticated;

-- 여행 데이터 테이블: Trip 객체 전체를 JSONB로 저장 (lib/types.ts의 Trip 타입 참고)
CREATE TABLE IF NOT EXISTS app_travel_plan.trips (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trips_user_id_idx ON app_travel_plan.trips (user_id);

ALTER TABLE app_travel_plan.trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own rows" ON app_travel_plan.trips;
CREATE POLICY "Users own rows" ON app_travel_plan.trips
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 여행 후기 사진 저장용 Storage 버킷 (lib/reportStorage.ts 참고)
-- 경로 규칙: {userId}/{tripId}/{reportId}/{photoId}.jpg — signed URL로만 조회 (비공개 버킷)
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users manage own report photos" ON storage.objects;
CREATE POLICY "Users manage own report photos" ON storage.objects
  FOR ALL USING (
    bucket_id = 'report-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'report-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 여러 프로젝트가 공유하는 테이블은 이 파일이 아니라 별도로 관리되는
-- `shared` 스키마를 사용한다 (여기서 중복 생성하지 않는다). 현재 travel-plan은 shared 테이블을 사용하지 않는다.
