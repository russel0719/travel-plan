# 여행 플래너

나만의 여행 일정을 계획하고, 지도에 동선을 표시하며, AI가 생성하는 여행 후기를 작성할 수 있는 모바일 우선 PWA 웹앱입니다.

## 주요 기능

### 일정 관리
- 날짜별 일정 카드 생성 및 편집 (관광·식당·숙박·이동)
- 시작~종료 시각 입력 (종료 자동 채움, 소요시간 빠른 선택, 자정 넘김 지원)
- 카테고리에 따라 다른 입력 항목 제공 (식당: 식사 유형·예약 필요 / 숙박: 체크인·체크아웃 / 이동: 출발지·도착지·이동수단)
- 드래그 앤 드롭으로 일정 순서 변경 (dnd-kit)
- 이동 수단 표시 (도보·대중교통·차량·택시·항공)

### 항공·숙박 관리
- 출발편/귀국편 항공권 정보 입력 및 예약 번호 관리
- 숙소 체크인/체크아웃 일정 및 예약 정보 관리, 주소는 Google 장소 검색으로 좌표까지 저장
- 일정 추가에서 카테고리를 "숙박"으로 바꾸면 해당 날짜에 겹치는 숙소 정보를 자동으로(애매하면 선택지로) 불러옴

### 예산 추적
- 카테고리별(항공·숙박·식비·교통·관광·쇼핑·기타) 예산 설정
- 일정 항목의 금액을 예산에 자동 연동
- 현지 통화 및 환율 설정

### 지도 시각화
- Google Maps에 일정 장소 마커 표시
- Google Routes API로 계산한 실제 도로 경로를 동선으로 표시(직선 폴백 지원)

### 장소 정보 (Google Places)
- 장소 자동완성 검색 (여행지 근처로 결과 편향)
- 지도를 눌러 장소 선택 — 이름은 몰라도 위치를 알 때
- 관광/식당 등 장소 선택 시 대표 사진을 함께 가져와 일정 카드에 표시
- 일정 카드에서 해당 장소를 Google 지도로 바로 열기

### AI 여행 후기
- 사진 업로드 및 날짜별 배치
- 사진에 코멘트 작성
- NVIDIA API(Llama 3.3 70B)가 일정과 사진 코멘트를 분석해 감성적인 여행 후기 자동 생성
- 후기 인쇄/PDF 출력 지원

### 인증 및 데이터 동기화
- Google OAuth 로그인 (Supabase Auth)
- 로그인 시 Supabase DB에 여행 데이터 자동 동기화
- 비로그인 상태에서 localStorage 임시 저장 → 첫 로그인 시 클라우드 자동 이전

### PWA
- 홈 화면 추가 지원 (iOS / Android)
- 서비스 워커를 통한 오프라인 대응

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui, lucide-react |
| 상태 관리 | Zustand (subscribeWithSelector) |
| 드래그 앤 드롭 | dnd-kit |
| 지도 | @vis.gl/react-google-maps |
| 백엔드 / 인증 | Supabase (PostgreSQL + Auth) |
| AI | NVIDIA API — meta/llama-3.3-70b-instruct |
| 배포 | Vercel |

## 코드베이스 구조

디렉토리 지도, 데이터 흐름, 상태 관리 방식, 그리고 조용히 발목 잡는 함정들은 **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** 에 정리되어 있습니다. 코드를 처음 만진다면 여기부터 읽으세요.

핵심만 요약하면:

- 데이터는 단일 Supabase 프로젝트의 `app_travel_plan` 스키마에 격리되어 있고, 여행 하나가 9개 정규화 테이블(`trips`, `schedule_items`, `flights`, `accommodations`, `budgets`, `budget_items`, `reports`, `report_day_texts`, `report_photos`)에 나뉘어 저장됩니다.
- 앱에서는 이 전부가 중첩된 `Trip` 객체 하나로 다뤄집니다 (`lib/types.ts`).
- 저장은 자동입니다 — 컴포넌트는 `save()`를 호출하지 않고, Zustand store가 `updatedAt` 변화를 감지해 `upsert_trip` RPC로 저장합니다.

## 환경 변수 설정

`.env.local` 파일을 생성하고 아래 변수를 설정하세요.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Maps (브라우저용 — Places API (New) 활성화 필요)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Google Routes API (서버 전용 — NEXT_PUBLIC_ 접두사 없음, 별도 키로 발급하고 Routes API 활성화 필요)
GOOGLE_ROUTES_API_KEY=your_google_routes_api_key

# NVIDIA API (AI 후기 생성)
NVIDIA_API_KEY=your_nvidia_api_key
```

`GOOGLE_ROUTES_API_KEY`가 없어도 앱은 정상 동작합니다 — 지도의 도로 경로만 조용히 비활성화되고(직선 동선으로 폴백), 에러가 나지 않습니다.

## 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

`http://localhost:3000` 에서 확인합니다.

## 배포

Vercel에 배포합니다. 위 환경 변수를 Vercel 프로젝트 설정에 추가하세요.

```bash
# 빌드 확인
npm run build
```

## 문서

| 문서 | 내용 |
|------|------|
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | **이 코드베이스 안내 — 파일 지도, 데이터 흐름, 필드 추가법, 함정 모음** |
| [docs/DATABASE.md](./docs/DATABASE.md) | DB 스키마 분리 규칙 |
| [docs/DESIGN.md](./docs/DESIGN.md) | UI/UX 디자인 시스템 |
| [docs/AUTH.md](./docs/AUTH.md) | 인증 전략 |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | 배포 절차 |
| [docs/IOS_WEBAPP.md](./docs/IOS_WEBAPP.md) | PWA / iOS 설정 |
| [docs/PROJECT_TEMPLATE.md](./docs/PROJECT_TEMPLATE.md) | 프로젝트 생성 체크리스트 |

> `ARCHITECTURE.md`는 "지금 있는 코드의 지도", 나머지는 "지켜야 할 규칙"입니다.
