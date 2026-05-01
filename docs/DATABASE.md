# DATABASE.md

## 1. Overview

This system operates on **a single Supabase project**.

All logical applications MUST be isolated using **PostgreSQL schemas**.
Creating multiple Supabase projects is NOT allowed.

---

## 2. Core Constraints (NON-NEGOTIABLE)

- Only ONE Supabase project is permitted
- Each application MUST have its own schema
- Cross-application table sharing is NOT allowed
- All queries MUST be schema-qualified
- `public` schema usage is prohibited unless explicitly required

---

## 3. Schema Architecture

### 3.1 Application Schemas

Each application is mapped 1:1 to a schema.

Example:

```
app1.*
app2.*
app3.*
```

Each schema must function as an independent service boundary.

---

### 3.2 Shared Schema

Common resources MUST be isolated in a dedicated schema:

```
shared.*
```

Rules:

- No shared tables inside application schemas
- No application-specific logic inside `shared`

---

## 4. Isolation Principles

- No cross-schema table placement
- No implicit references between schemas
- All joins MUST explicitly reference schema names
- Schemas should remain loosely coupled

---

## 5. Naming & Query Conventions

### Required

- Always use schema-qualified names:
  - `app1.users`
  - `app2.orders`

### Forbidden

- Unqualified table access:

```sql
SELECT * FROM users;
```

### Correct Example

```sql
SELECT * FROM app1.users;
```

---

## 6. Authentication Strategy

Supabase Auth is global and cannot be separated per schema.

To enforce logical isolation:

- Use:
  - `user_metadata`
  - `app_metadata`

- Recommended extensions:
  - `tenant_id`
  - `app_id`
  - role-based access control (RBAC)

---

## 7. Migration Rules

- Schema MUST be explicitly created before usage
- All migrations MUST be schema-aware
- Default schema (`public`) must not be used implicitly

### Example

```sql
CREATE SCHEMA IF NOT EXISTS app1;

CREATE TABLE app1.users (
  id uuid PRIMARY KEY,
  email text
);
```

---

## 8. LLM Agent Execution Rules

When generating database designs:

- ALWAYS separate applications into schemas
- NEVER merge multiple applications into one schema
- ALWAYS include schema-qualified table definitions
- MUST output:
  - schema list
  - tables per schema

- MUST explain isolation strategy
- MUST mention limitations of single-project architecture

If any rule is violated:
→ Correct it before continuing

---

## 9. Anti-Patterns (STRICTLY FORBIDDEN)

- Creating multiple Supabase projects
- Using only `public` schema for all applications
- Mixing tables from different apps in one schema
- Omitting schema in queries
- Creating tight coupling across schemas

---

## 10. Design Philosophy

Each schema is treated as:

> An independent backend service within a shared infrastructure

Design goals:

- Strong logical isolation
- Clear ownership boundaries
- Minimal cross-schema dependencies

---

## 11. Refactoring Guidelines

Move to multiple Supabase projects when:

- Full isolation is required
- Security boundaries become critical
- Independent scaling is necessary
- Team ownership diverges
