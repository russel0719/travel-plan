-- 정규화 2단계: trips.data(jsonb)에 있던 기존 데이터를 0002에서 만든 신규 테이블로 옮긴다.
-- 재실행 가능하도록 신규 테이블만 먼저 비우고 다시 채운다 (trips.data 자체는 건드리지 않음 — 롤백 안전망).
-- 전체를 트랜잭션으로 감싸 ETL 도중 실패 시 부분 반영을 방지한다.

BEGIN;

DELETE FROM app_travel_plan.report_photos;
DELETE FROM app_travel_plan.report_day_texts;
DELETE FROM app_travel_plan.reports;
DELETE FROM app_travel_plan.budget_items;
DELETE FROM app_travel_plan.budgets;
DELETE FROM app_travel_plan.accommodations;
DELETE FROM app_travel_plan.flights;
DELETE FROM app_travel_plan.schedule_items;

-- trips 메타 컬럼 백필
UPDATE app_travel_plan.trips SET
  title = data ->> 'title',
  destination = data ->> 'destination',
  start_date = (data ->> 'startDate')::date,
  end_date = (data ->> 'endDate')::date,
  is_international = (data ->> 'isInternational')::boolean;

-- schedule_items (days[].items[])
INSERT INTO app_travel_plan.schedule_items (
  id, trip_id, day_date, position, type, title, time, duration,
  location_name, location_lat, location_lng, location_address,
  from_location_name, from_location_lat, from_location_lng, from_location_address,
  transport_to_next, notes, price, currency, meal_type, reservation_needed, check_type, transport_mode
)
SELECT
  (item ->> 'id')::uuid,
  t.id,
  (day ->> 'date')::date,
  (item_ord - 1)::integer,
  item ->> 'type',
  item ->> 'title',
  nullif(item ->> 'time', ''),
  (item ->> 'duration')::integer,
  item -> 'location' ->> 'name',
  (item -> 'location' ->> 'lat')::double precision,
  (item -> 'location' ->> 'lng')::double precision,
  item -> 'location' ->> 'address',
  item -> 'fromLocation' ->> 'name',
  (item -> 'fromLocation' ->> 'lat')::double precision,
  (item -> 'fromLocation' ->> 'lng')::double precision,
  item -> 'fromLocation' ->> 'address',
  item ->> 'transportToNext',
  item ->> 'notes',
  (item ->> 'price')::numeric,
  item ->> 'currency',
  item ->> 'mealType',
  (item ->> 'reservationNeeded')::boolean,
  item ->> 'checkType',
  item ->> 'transportMode'
FROM app_travel_plan.trips t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t.data -> 'days') = 'array' THEN t.data -> 'days' ELSE '[]'::jsonb END
) AS day
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(day -> 'items') = 'array' THEN day -> 'items' ELSE '[]'::jsonb END
) WITH ORDINALITY AS di (item, item_ord);

-- flights
INSERT INTO app_travel_plan.flights (
  id, trip_id, direction, airline, flight_number, departure_airport, departure_date, departure_time,
  arrival_airport, arrival_date, arrival_time, booking_ref, seat, price_krw
)
SELECT
  (f ->> 'id')::uuid, t.id, f ->> 'direction', f ->> 'airline', f ->> 'flightNumber',
  f ->> 'departureAirport', (f ->> 'departureDate')::date, f ->> 'departureTime',
  f ->> 'arrivalAirport', (f ->> 'arrivalDate')::date, f ->> 'arrivalTime',
  f ->> 'bookingRef', f ->> 'seat', (f ->> 'priceKRW')::integer
FROM app_travel_plan.trips t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t.data -> 'flights') = 'array' THEN t.data -> 'flights' ELSE '[]'::jsonb END
) AS f;

-- accommodations
INSERT INTO app_travel_plan.accommodations (
  id, trip_id, name, address, check_in_date, check_in_time, check_out_date, check_out_time,
  booking_platform, booking_ref, phone, price_krw
)
SELECT
  (a ->> 'id')::uuid, t.id, a ->> 'name', a ->> 'address',
  (a ->> 'checkInDate')::date, a ->> 'checkInTime', (a ->> 'checkOutDate')::date, a ->> 'checkOutTime',
  a ->> 'bookingPlatform', a ->> 'bookingRef', a ->> 'phone', (a ->> 'priceKRW')::integer
FROM app_travel_plan.trips t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t.data -> 'accommodations') = 'array' THEN t.data -> 'accommodations' ELSE '[]'::jsonb END
) AS a;

-- budgets (trip당 0~1건 — data->'budget'이 object일 때만)
INSERT INTO app_travel_plan.budgets (trip_id, local_currency, exchange_rate)
SELECT t.id, t.data -> 'budget' ->> 'localCurrency', (t.data -> 'budget' ->> 'exchangeRate')::numeric
FROM app_travel_plan.trips t
WHERE jsonb_typeof(t.data -> 'budget') = 'object';

-- budget_items
INSERT INTO app_travel_plan.budget_items (id, trip_id, category, label, planned_krw)
SELECT
  (bi ->> 'id')::uuid, t.id, bi ->> 'category', bi ->> 'label', (bi ->> 'plannedKRW')::integer
FROM app_travel_plan.trips t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t.data -> 'budget' -> 'items') = 'array' THEN t.data -> 'budget' -> 'items' ELSE '[]'::jsonb END
) AS bi
WHERE jsonb_typeof(t.data -> 'budget') = 'object';

-- reports
INSERT INTO app_travel_plan.reports (id, trip_id, title, created_at, status, user_notes, ai_generated_text, schedule_summary)
SELECT
  (r ->> 'id')::uuid, t.id, r ->> 'title', (r ->> 'createdAt')::timestamptz, r ->> 'status',
  coalesce(r ->> 'userNotes', ''), coalesce(r ->> 'aiGeneratedText', ''), coalesce(r ->> 'scheduleSummary', '')
FROM app_travel_plan.trips t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t.data -> 'reports') = 'array' THEN t.data -> 'reports' ELSE '[]'::jsonb END
) AS r;

-- report_day_texts (aiDayTexts: Record<dayIndex,string> 객체 순회)
INSERT INTO app_travel_plan.report_day_texts (report_id, trip_id, day_index, text)
SELECT
  (r ->> 'id')::uuid, t.id, kv.key::integer, kv.value
FROM app_travel_plan.trips t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t.data -> 'reports') = 'array' THEN t.data -> 'reports' ELSE '[]'::jsonb END
) AS r
CROSS JOIN LATERAL jsonb_each_text(
  CASE WHEN jsonb_typeof(r -> 'aiDayTexts') = 'object' THEN r -> 'aiDayTexts' ELSE '{}'::jsonb END
) AS kv (key, value);

-- report_photos (photoMeta[])
INSERT INTO app_travel_plan.report_photos (id, report_id, trip_id, storage_path, day_index, position, comment)
SELECT
  (p ->> 'id')::uuid, (r ->> 'id')::uuid, t.id, p ->> 'storagePath', (p ->> 'dayIndex')::integer,
  (p ->> 'order')::integer, coalesce(p ->> 'comment', '')
FROM app_travel_plan.trips t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t.data -> 'reports') = 'array' THEN t.data -> 'reports' ELSE '[]'::jsonb END
) AS r
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(r -> 'photoMeta') = 'array' THEN r -> 'photoMeta' ELSE '[]'::jsonb END
) AS p;

-- 필수 메타 컬럼이 전부 채워졌는지 검증한 뒤에만 NOT NULL로 전환
DO $$
DECLARE
  v_null_count integer;
BEGIN
  SELECT count(*) INTO v_null_count FROM app_travel_plan.trips
    WHERE title IS NULL OR destination IS NULL OR start_date IS NULL
       OR end_date IS NULL OR is_international IS NULL;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'ETL 불완전: trips % 건이 필수 메타 필드를 채우지 못함', v_null_count;
  END IF;
END $$;

ALTER TABLE app_travel_plan.trips
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN destination SET NOT NULL,
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL,
  ALTER COLUMN is_international SET NOT NULL;

COMMIT;
