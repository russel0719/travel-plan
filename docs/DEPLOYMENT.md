# DEPLOYMENT.md

## 1. Overview

- Platform: Vercel
- Environment: Production / Preview / Development

---

## 2. Environment Variables

Required:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

- SUPABASE_SERVICE_ROLE_KEY (server only)

Optional (읽기 전용 내보내기 API `/api/export/*` — 없으면 503 으로 꺼진다):

- EXPORT_API_TOKEN (server only) — 부르는 쪽(taleframe)의 TRAVEL_PLAN_TOKEN 과 같은 값. `openssl rand -hex 32`
- EXPORT_USER_ID (server only) — 내보낼 사람의 auth.users id (이 사람의 여행만 나간다)

---

## 3. Deployment Flow

1. Push to GitHub
2. Vercel auto-deploy
3. Preview URL generated

---

## 4. Branch Strategy

- main → production
- dev → preview

---

## 5. Supabase Setup

- Single project
- Schema per app

---

## 6. Domain Strategy

- project1.vercel.app
- custom domain optional
