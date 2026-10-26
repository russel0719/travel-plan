-- app_travel_plan 을 service_role 로 읽을 수 있게 한다.
--
-- 왜: travel-video-maker(~/workspace/travel-video-maker)가 여행 사진으로 영상을 만들 때
--     사진 EXIF 촬영 시각을 schedule_items 구간에 떨어뜨려 "이 컷은 어느 일정에서
--     찍혔나"를 알아내고 자막 초안으로 쓴다. 그 앱은 localhost 전용이라 사용자 로그인
--     없이 service_role 키로 읽는다.
--
-- 왜 지금까지 안 됐나: 0001_init.sql 이 `anon, authenticated` 에게만 권한을 줬다.
--     service_role 은 RLS 는 우회하지만 **스키마 USAGE 권한까지 우회하지는 않는다.**
--     그래서 PostgREST 가 42501 "permission denied for schema app_travel_plan" 을
--     HTTP 403 으로 돌려줬다.
--
-- 범위: **읽기만, 실제로 읽는 두 테이블만.** travel-video-maker 는 쓰지 않는다.
--     테이블을 더 열면 그 앱이 무엇을 읽는지가 흐려진다. 나중에 다른 테이블이
--     필요해지면 그때 이 파일 옆에 새 마이그레이션을 만든다.
--
-- 이 프로젝트(travel-plan)의 동작에는 영향이 없다 — anon/authenticated 권한은
-- 그대로이고 RLS 정책도 건드리지 않는다.

grant usage on schema app_travel_plan to service_role;

grant select on app_travel_plan.trips          to service_role;
grant select on app_travel_plan.schedule_items to service_role;
