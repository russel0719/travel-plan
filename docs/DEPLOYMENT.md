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
