-- 정규화 4단계(최종): 검증 완료 후 레거시 trips.data(jsonb) 컬럼 제거.
-- 코드(lib/storage.ts)는 이미 이 컬럼을 전혀 참조하지 않는다.
-- 만약을 대비해 제거 직전 값을 앱이 쓰지 않는 별도 백업 테이블에 남겨둔다.
CREATE TABLE IF NOT EXISTS app_travel_plan.trips_data_backup_20260710 AS
SELECT id, user_id, data, created_at, updated_at FROM app_travel_plan.trips;

ALTER TABLE app_travel_plan.trips DROP COLUMN IF EXISTS data;
