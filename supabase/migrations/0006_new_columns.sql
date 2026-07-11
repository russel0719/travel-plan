-- 숙박 Google 장소 검색(좌표) + 일정의 Google Place Details(평점/사진) 지원용 신규 컬럼.
-- 전부 nullable, ADD COLUMN IF NOT EXISTS — additive라 기존 앱 동작에 영향 없음.

ALTER TABLE app_travel_plan.accommodations
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

ALTER TABLE app_travel_plan.schedule_items
  ADD COLUMN IF NOT EXISTS place_rating numeric,
  ADD COLUMN IF NOT EXISTS place_photo_url text;
