-- 일정 카드에서 Google 평점 표시를 없애고 Google 지도 링크(좌표/이름 기반, 저장 불필요)로 대체하면서
-- place_rating을 더 이상 수집·저장하지 않게 되었다. RPC가 이 컬럼을 참조하므로 함수를 먼저 교체한 뒤
-- 컬럼을 제거한다. place_photo_url(대표 사진)은 계속 사용하므로 유지한다.
--
-- 파일명은 전역 규칙(~/.claude/CLAUDE.md 3.2)에 따라 타임스탬프로 만든다 — 기존 0001~0007은 순번이지만
-- 마이그레이션 히스토리를 다른 프로젝트와 공유하므로 신규 버전은 충돌을 피해 타임스탬프를 쓴다.

-- 0007_upsert_trip_function_v2.sql과 동일하되 schedule_items의 place_rating 컬럼/값만 제거.
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
    id, trip_id, day_date, position, type, title, time, duration,
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

ALTER TABLE app_travel_plan.schedule_items DROP COLUMN IF EXISTS place_rating;
