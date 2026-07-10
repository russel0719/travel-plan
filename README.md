# 여행 플래너

나만의 여행 일정을 계획하고, 지도에 동선을 표시하며, AI가 생성하는 여행 후기를 작성할 수 있는 모바일 우선 PWA 웹앱입니다.

## 주요 기능

### 일정 관리
- 날짜별 일정 카드 생성 및 편집 (관광·식당·숙박·이동)
- 카테고리에 따라 다른 입력 항목 제공 (식당: 식사 유형·예약 필요 / 숙박: 체크인·체크아웃 / 이동: 출발지·도착지·이동수단)
- 드래그 앤 드롭으로 일정 순서 변경 (dnd-kit)
- 이동 수단 표시 (도보·대중교통·차량·택시·항공)

### 항공·숙박 관리
- 출발편/귀국편 항공권 정보 입력 및 예약 번호 관리
- 숙소 체크인/체크아웃 일정 및 예약 정보 관리

### 예산 추적
- 카테고리별(항공·숙박·식비·교통·관광·쇼핑·기타) 예산 설정
- 일정 항목의 금액을 예산에 자동 연동
- 현지 통화 및 환율 설정

### 지도 시각화
- Google Maps에 일정 장소 마커 표시
- 장소 간 이동 경로 동선 시각화

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

## 프로젝트 구조

```
travel-plan/
├── app/
│   ├── page.tsx                        # 홈 (여행 목록)
│   ├── trip/[id]/
│   │   ├── page.tsx                    # 여행 상세 (일정·항공·예산·후기)
│   │   ├── print/page.tsx              # 일정 인쇄
│   │   └── report/[reportId]/
│   │       ├── page.tsx                # 후기 상세
│   │       └── print/page.tsx          # 후기 인쇄
│   └── api/generate-report/route.ts    # AI 후기 생성 엔드포인트
├── components/
│   ├── auth/LoginPage.tsx
│   ├── map/TripMap.tsx
│   ├── report/                         # 후기 업로드·코멘트 패널
│   ├── trip/                           # 일정·항공·숙박·예산 컴포넌트
│   └── ui/                             # shadcn/ui 기반 공통 컴포넌트
├── lib/
│   ├── types.ts                        # Trip, ScheduleItem 등 타입 정의
│   ├── storage.ts                      # Supabase CRUD
│   ├── supabase.ts                     # Supabase 클라이언트
│   └── utils.ts
├── store/
│   └── tripStore.ts                    # Zustand 스토어 (상태 + Supabase 자동 동기화)
├── public/
│   ├── manifest.json                   # PWA 매니페스트
│   └── sw.js                           # 서비스 워커
└── docs/                               # 아키텍처 문서
```

## 데이터 아키텍처

단일 Supabase 프로젝트에서 스키마 분리 방식으로 애플리케이션을 격리합니다.

- 스키마: `app_travel_plan`
- 여행 데이터는 엔티티별로 정규화된 테이블에 저장: `trips`(메타데이터), `schedule_items`, `flights`, `accommodations`, `budgets`, `budget_items`, `reports`, `report_day_texts`, `report_photos` — 전부 `trip_id` FK(`ON DELETE CASCADE`) + RLS
- Zustand store가 trips 변경을 감지해, 변경된 트립은 `upsert_trip` RPC(단일 트랜잭션으로 트립 메타 + 모든 하위 테이블을 원자적으로 replace)를 통해 저장하고, 읽기는 `lib/storage.ts`가 9개 테이블을 조회해 `lib/tripAssembly.ts`에서 기존 `Trip` 타입으로 재조립
- 레거시 `trips.data`(jsonb 통짜 저장) 컬럼은 검증 완료 후 제거됨 (`0005_drop_legacy_data_column.sql`) — 제거 직전 값은 `trips_data_backup_20260710` 테이블에 백업

## 환경 변수 설정

`.env.local` 파일을 생성하고 아래 변수를 설정하세요.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# NVIDIA API (AI 후기 생성)
NVIDIA_API_KEY=your_nvidia_api_key
```

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
| [docs/DATABASE.md](./docs/DATABASE.md) | DB 스키마 아키텍처 |
| [docs/DESIGN.md](./docs/DESIGN.md) | UI/UX 디자인 시스템 |
| [docs/AUTH.md](./docs/AUTH.md) | 인증 전략 |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | 배포 절차 |
| [docs/IOS_WEBAPP.md](./docs/IOS_WEBAPP.md) | PWA / iOS 설정 |
| [docs/PROJECT_TEMPLATE.md](./docs/PROJECT_TEMPLATE.md) | 프로젝트 생성 체크리스트 |
