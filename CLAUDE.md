# CLAUDE.md

## 1. Purpose

This document is the **central orchestration layer** for all side projects.

It defines:

- When each document must be referenced
- What rules are mandatory
- How projects are generated and maintained

All other markdown files are **subsystems**.
This file controls their usage.

---

## 2. System Overview

Each document has a specific role:

| Document            | Role                       |
| ------------------- | -------------------------- |
| DATABASE.md         | Data architecture rules    |
| DESIGN.md           | UI/UX system               |
| DEPLOYMENT.md       | Deployment process         |
| AUTH.md             | Authentication strategy    |
| IOS_WEBAPP.md       | PWA / iOS behavior         |
| PROJECT_TEMPLATE.md | Project creation checklist |

---

## 3. Document Usage Rules (CRITICAL)

### 3.1 When to Read [DATABASE.md](./docs/DATABASE.md)

MUST be referenced when:

- Designing database schema
- Writing SQL
- Creating tables
- Designing RLS policies

---

### 3.2 When to Read [DESIGN.md](./docs/DESIGN.md)

MUST be referenced when:

- Creating UI components
- Designing layouts
- Styling pages
- Building responsive UI

---

### 3.3 When to Read [DEPLOYMENT.md](./docs/DEPLOYMENT.md)

MUST be referenced when:

- Setting up environment variables
- Deploying to Vercel
- Configuring domains
- Managing environments

---

### 3.4 When to Read [AUTH.md](./docs/AUTH.md)

MUST be referenced when:

- Implementing authentication
- Accessing user data
- Handling sessions

---

### 3.5 When to Read [IOS_WEBAPP.md](./docs/IOS_WEBAPP.md)

MUST be referenced when:

- Adding PWA support
- Creating app icons
- Handling mobile install behavior

---

### 3.6 When to Read [PROJECT_TEMPLATE.md](./docs/PROJECT_TEMPLATE.md)

MUST be referenced when:

- Starting a new project
- Initializing structure

---

## 4. Non-Negotiable Rules

- Only ONE Supabase project
- Schema-per-application architecture
- Google OAuth only
- Deployment via Vercel only
- Mobile-first UI
- PWA support required

---

## 5. Project Lifecycle

### Step 1 — Project Initialization

- MUST follow [PROJECT_TEMPLATE.md](./docs/PROJECT_TEMPLATE.md)
- MUST create new schema:
  - `app_<project_name>`

---

### Step 2 — Database Design

- MUST follow [DATABASE.md](./docs/DATABASE.md)
- MUST:
  - use schema-qualified tables
  - isolate application data

---

### Step 3 — UI Development

- MUST follow [DESIGN.md](./docs/DESIGN.md)
- MUST:
  - be mobile-first
  - use predefined tokens

---

### Step 4 — Auth Integration

- MUST follow [AUTH.md](./docs/AUTH.md)
- MUST:
  - use Google OAuth
  - attach app_id to user

---

### Step 5 — PWA Setup

- MUST follow [IOS_WEBAPP.md](./docs/IOS_WEBAPP.md)

---

### Step 6 — Deployment

- MUST follow [DEPLOYMENT.md](./docs/DEPLOYMENT.md)

---

## 6. Code Generation Rules

When generating code:

- ALWAYS:
  - specify schema
  - follow design tokens
  - include responsive layout

- NEVER:
  - use public schema implicitly
  - create multiple Supabase projects
  - ignore mobile layout

---

## 7. Decision Priority

When conflicts occur:

1. CLAUDE.md (this file)
2. DATABASE.md
3. DESIGN.md
4. Others

---

## 8. Anti-Patterns

- Skipping document references ❌
- Mixing design styles ❌
- Creating custom architecture per project ❌
- Ignoring mobile UX ❌

---

## 9. Execution Model

Every task MUST follow this sequence:

1. Identify task type
   - UI / DB / Deploy / Auth / PWA

2. Load corresponding document

3. Apply rules BEFORE implementation

---

## 10. Example Flows

### Example 1 — Create Table

→ Read DATABASE.md  
→ Then generate schema-qualified SQL

---

### Example 2 — Build Page

→ Read DESIGN.md  
→ Then implement layout

---

### Example 3 — Deploy

→ Read DEPLOYMENT.md  
→ Then configure environment

---

## 11. Enforcement

If any rule is violated:

- Stop
- Correct the design
- Re-apply rules

No exceptions.
