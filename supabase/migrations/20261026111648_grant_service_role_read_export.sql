-- 내보내기 API(app/api/export/*)가 항공편·숙소를 service_role 로 읽을 수 있게 한다.
--
-- 왜: taleframe(~/workspace/taleframe — 여행 후기 사이트)이 스토리를 만들 때 이 앱의 계획을
--     읽어 "사진마다 어디서 무엇을 하던 중이었나"를 사용자에게 다시 묻지 않으려고 한다.
--     taleframe 은 DB 키를 갖지 않고, 이 앱의 /api/export/* 를 개인 토큰으로 부른다.
--     그 라우트가 서버에서 service_role 로 읽는다.
--
-- 범위: **읽기만.** trips·schedule_items 는 20260830191513 에서 이미 열었다.
--     항공편은 승차권·출발 안내판(편명·시각), 숙소는 지도·글의 숙소 위치(이름·좌표)에 쓴다.
--     예약번호·전화·좌석·숙소 주소는 API 응답에서 애초에 고르지 않는다(lib/exportApi.ts).
--     budget_items 는 계획 예산이라 실제 지출로 오인될 수 있어 열지 않는다.
--
-- 이 프로젝트의 동작에는 영향이 없다 — anon/authenticated 권한과 RLS 정책은 그대로다.

grant usage on schema app_travel_plan to service_role;

grant select on app_travel_plan.flights        to service_role;
grant select on app_travel_plan.accommodations to service_role;
