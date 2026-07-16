-- 일정의 시각을 "시작 + 체류시간(분)"에서 "시작 + 종료"로 바꾼다.
-- time(text "HH:MM") + duration(int, 분) → start_time / end_time (둘 다 text "HH:MM").
--
-- ★ 이 마이그레이션은 되돌릴 수 없다(DROP COLUMN). Supabase 무료 플랜은 PITR이 없으므로
--   아래 백업 테이블이 유일한 복구 수단이다. 검증에 실패하면 트랜잭션 전체가 롤백된다.

-- ── ① 그물: 원본 값을 통째로 보존 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_travel_plan._schedule_items_time_backup_20260717 AS
SELECT id, "time", duration
FROM app_travel_plan.schedule_items
WHERE "time" IS NOT NULL OR duration IS NOT NULL;

-- ── ② 신규 컬럼 (additive) ──────────────────────────────────────────────────
-- Postgres의 time 타입이 아니라 text를 쓴다 — PostgREST가 time을 "10:00:00"으로 내려줘서
-- <input type="time">과의 왕복이 지저분해지고, flights.departure_time / accommodations.check_in_time도
-- 이미 text라 그쪽과 일관된다.
ALTER TABLE app_travel_plan.schedule_items
  ADD COLUMN IF NOT EXISTS start_time text,
  ADD COLUMN IF NOT EXISTS end_time text;

-- ── ③ 수동 보정: 시작 시각 없이 duration만 있는 행 ──────────────────────────
-- "아침 (메리켄야)"(2026-10-22)는 time이 NULL인데 duration=40이라 기계적으로 백필하면 그 40분이
-- 영구히 사라진다. 바로 다음 일정이 08:12 페리라 그 직전(07:30~08:10)으로 사용자가 확정했다.
UPDATE app_travel_plan.schedule_items
SET "time" = '07:30'
WHERE "time" IS NULL
  AND duration = 40
  AND day_date = DATE '2026-10-22'
  AND title = '아침 (메리켄야)';

-- ── ④ 백필 ─────────────────────────────────────────────────────────────────
-- 정규식 가드가 없으면 파싱 불가능한 값 하나 때문에 UPDATE 전체가 롤백된다.
-- time + interval은 자정을 넘기면 모듈로 24로 wrap한다('23:30' + 60min → '00:30').
-- 그게 이 스키마의 자정 처리 전부다 — end_time < start_time이면 익일이라는 뜻.
UPDATE app_travel_plan.schedule_items s
SET start_time = to_char(p.t, 'HH24:MI'),
    end_time = CASE
      -- 0 이하는 의미 없고, 24시간 이상은 wrap하면 시작과 같아져 "10:00 ~ 10:00"이 된다.
      WHEN p.duration IS NULL OR p.duration <= 0 OR p.duration >= 1440 THEN NULL
      ELSE to_char(p.t + make_interval(mins => p.duration), 'HH24:MI')
    END
FROM (
  SELECT id,
         CASE WHEN "time" ~ '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$' THEN ("time")::time END AS t,
         duration
  FROM app_travel_plan.schedule_items
) p
WHERE s.id = p.id AND p.t IS NOT NULL;

-- ── ⑤ 검증 가드: 하나라도 어긋나면 여기서 전체 롤백 ─────────────────────────
DO $$
DECLARE
  v_lost_time int;
  v_lost_duration int;
BEGIN
  SELECT count(*) INTO v_lost_time
  FROM app_travel_plan.schedule_items
  WHERE "time" IS NOT NULL AND start_time IS NULL;
  IF v_lost_time > 0 THEN
    RAISE EXCEPTION '중단: time이 있는데 start_time으로 옮겨지지 않은 행이 %건 있습니다.', v_lost_time;
  END IF;

  SELECT count(*) INTO v_lost_duration
  FROM app_travel_plan.schedule_items
  WHERE duration IS NOT NULL AND duration BETWEEN 1 AND 1439 AND end_time IS NULL;
  IF v_lost_duration > 0 THEN
    RAISE EXCEPTION '중단: duration이 있는데 end_time을 만들지 못한 행이 %건 있습니다(백필 불가 = 영구 소실).', v_lost_duration;
  END IF;
END $$;

-- ── ⑥ RPC 교체 (컬럼을 참조하므로 DROP보다 먼저) ────────────────────────────
-- 20260717000758_drop_place_rating.sql과 동일하되 time/duration → start_time/end_time.
CREATE OR REPLACE FUNCTION app_travel_plan.upsert_trip(p_trip jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = app_travel_plan, pg_temp
AS $$
DECLARE
  v_trip_id uuid := (p_trip ->> 'id')::uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'upsert_trip: not authenticated';
  END IF;

  INSERT INTO app_travel_plan.trips (
    id, user_id, title, destination, start_date, end_date, is_international, created_at, updated_at
  )
  VALUES (
    v_trip_id, v_uid,
    p_trip ->> 'title', p_trip ->> 'destination',
    (p_trip ->> 'startDate')::date, (p_trip ->> 'endDate')::date,
    (p_trip ->> 'isInternational')::boolean,
    (p_trip ->> 'createdAt')::timestamptz, (p_trip ->> 'updatedAt')::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    title = excluded.title,
    destination = excluded.destination,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    is_international = excluded.is_international,
    updated_at = excluded.updated_at;
  -- RLS(USING/WITH CHECK: auth.uid() = user_id)가 이미 이 INSERT/UPDATE 양쪽에 적용되므로
  -- 다른 사용자의 trip_id로 시도하면 이 문장 자체에서 RLS 위반으로 실패한다.

  DELETE FROM app_travel_plan.schedule_items WHERE trip_id = v_trip_id;
  INSERT INTO app_travel_plan.schedule_items (
    id, trip_id, day_date, position, type, title, start_time, end_time,
    location_name, location_lat, location_lng, location_address,
    from_location_name, from_location_lat, from_location_lng, from_location_address,
    transport_to_next, notes, price, currency, meal_type, reservation_needed, check_type, transport_mode,
    place_photo_url
  )
  SELECT
    (item ->> 'id')::uuid,
    v_trip_id,
    (day ->> 'date')::date,
    (item_ord - 1)::integer,
    item ->> 'type',
    item ->> 'title',
    nullif(item ->> 'startTime', ''),
    nullif(item ->> 'endTime', ''),
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
    item ->> 'transportMode',
    item ->> 'placePhotoUrl'
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_trip -> 'days') = 'array' THEN p_trip -> 'days' ELSE '[]'::jsonb END
  ) AS day
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(day -> 'items') = 'array' THEN day -> 'items' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS di (item, item_ord);

  DELETE FROM app_travel_plan.flights WHERE trip_id = v_trip_id;
  INSERT INTO app_travel_plan.flights (
    id, trip_id, direction, airline, flight_number, departure_airport, departure_date, departure_time,
    arrival_airport, arrival_date, arrival_time, booking_ref, seat, price_krw
  )
  SELECT
    (f ->> 'id')::uuid, v_trip_id, f ->> 'direction', f ->> 'airline', f ->> 'flightNumber',
    f ->> 'departureAirport', (f ->> 'departureDate')::date, f ->> 'departureTime',
    f ->> 'arrivalAirport', (f ->> 'arrivalDate')::date, f ->> 'arrivalTime',
    f ->> 'bookingRef', f ->> 'seat', (f ->> 'priceKRW')::integer
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_trip -> 'flights') = 'array' THEN p_trip -> 'flights' ELSE '[]'::jsonb END
  ) AS f;

  DELETE FROM app_travel_plan.accommodations WHERE trip_id = v_trip_id;
  INSERT INTO app_travel_plan.accommodations (
    id, trip_id, name, address, lat, lng, check_in_date, check_in_time, check_out_date, check_out_time,
    booking_platform, booking_ref, phone, price_krw
  )
  SELECT
    (a ->> 'id')::uuid, v_trip_id, a ->> 'name', a ->> 'address',
    (a ->> 'lat')::double precision, (a ->> 'lng')::double precision,
    (a ->> 'checkInDate')::date, a ->> 'checkInTime', (a ->> 'checkOutDate')::date, a ->> 'checkOutTime',
    a ->> 'bookingPlatform', a ->> 'bookingRef', a ->> 'phone', (a ->> 'priceKRW')::integer
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_trip -> 'accommodations') = 'array' THEN p_trip -> 'accommodations' ELSE '[]'::jsonb END
  ) AS a;

  DELETE FROM app_travel_plan.budgets WHERE trip_id = v_trip_id;
  IF jsonb_typeof(p_trip -> 'budget') = 'object' THEN
    INSERT INTO app_travel_plan.budgets (trip_id, local_currency, exchange_rate)
    VALUES (
      v_trip_id,
      p_trip -> 'budget' ->> 'localCurrency',
      (p_trip -> 'budget' ->> 'exchangeRate')::numeric
    );
  END IF;

  DELETE FROM app_travel_plan.budget_items WHERE trip_id = v_trip_id;
  IF jsonb_typeof(p_trip -> 'budget') = 'object' THEN
    INSERT INTO app_travel_plan.budget_items (id, trip_id, category, label, planned_krw)
    SELECT
      (bi ->> 'id')::uuid, v_trip_id, bi ->> 'category', bi ->> 'label', (bi ->> 'plannedKRW')::integer
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_trip -> 'budget' -> 'items') = 'array' THEN p_trip -> 'budget' -> 'items' ELSE '[]'::jsonb END
    ) AS bi;
  END IF;

  DELETE FROM app_travel_plan.report_photos WHERE trip_id = v_trip_id;
  DELETE FROM app_travel_plan.report_day_texts WHERE trip_id = v_trip_id;
  DELETE FROM app_travel_plan.reports WHERE trip_id = v_trip_id;

  INSERT INTO app_travel_plan.reports (id, trip_id, title, created_at, status, user_notes, ai_generated_text, schedule_summary)
  SELECT
    (r ->> 'id')::uuid, v_trip_id, r ->> 'title', (r ->> 'createdAt')::timestamptz, r ->> 'status',
    coalesce(r ->> 'userNotes', ''), coalesce(r ->> 'aiGeneratedText', ''), coalesce(r ->> 'scheduleSummary', '')
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_trip -> 'reports') = 'array' THEN p_trip -> 'reports' ELSE '[]'::jsonb END
  ) AS r;

  INSERT INTO app_travel_plan.report_day_texts (report_id, trip_id, day_index, text)
  SELECT
    (r ->> 'id')::uuid, v_trip_id, kv.key::integer, kv.value
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_trip -> 'reports') = 'array' THEN p_trip -> 'reports' ELSE '[]'::jsonb END
  ) AS r
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(r -> 'aiDayTexts') = 'object' THEN r -> 'aiDayTexts' ELSE '{}'::jsonb END
  ) AS kv (key, value);

  INSERT INTO app_travel_plan.report_photos (id, report_id, trip_id, storage_path, day_index, position, comment)
  SELECT
    (p ->> 'id')::uuid, (r ->> 'id')::uuid, v_trip_id, p ->> 'storagePath', (p ->> 'dayIndex')::integer,
    (p ->> 'order')::integer, coalesce(p ->> 'comment', '')
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_trip -> 'reports') = 'array' THEN p_trip -> 'reports' ELSE '[]'::jsonb END
  ) AS r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r -> 'photoMeta') = 'array' THEN r -> 'photoMeta' ELSE '[]'::jsonb END
  ) AS p;
END;
$$;

REVOKE ALL ON FUNCTION app_travel_plan.upsert_trip(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_travel_plan.upsert_trip(jsonb) TO authenticated;

-- ── ⑦ 레거시 컬럼 제거 ──────────────────────────────────────────────────────
-- 백업 테이블(_schedule_items_time_backup_20260717)은 여기서 지우지 않는다. 몇 주 관찰 후 별도로.
ALTER TABLE app_travel_plan.schedule_items
  DROP COLUMN IF EXISTS "time",
  DROP COLUMN IF EXISTS duration;
