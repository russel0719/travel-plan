# DESIGN.md

## 1. Philosophy

This design system prioritizes:

- Clarity over decoration
- Speed over visual complexity
- Consistency across all projects
- Mobile-first usability

The UI must feel:

- Flat
- Minimal
- Functional
- Predictable

No brand-heavy styling.
No visual noise.

---

## 2. Core Principles

### 2.1 Flat Design

- No shadows
- No gradients
- No glassmorphism
- No heavy borders

Use only:

- color
- spacing
- typography

to create hierarchy.

---

### 2.2 Mobile-First

- Design starts at 375px width
- Desktop is an extension, not primary

---

### 2.3 Touch-Optimized

- Minimum tap target: 44px
- Avoid hover-based interactions

---

### 2.4 Consistency > Creativity

- Same layout patterns reused
- Same spacing rules everywhere
- Same components reused across apps

---

## 3. Color System

### Base

- `bg-primary`: #ffffff
- `bg-secondary`: #f9fafb
- `bg-tertiary`: #f3f4f6

---

### Text

- `text-primary`: #111827
- `text-secondary`: #6b7280
- `text-disabled`: #9ca3af

---

### Brand (single accent)

- `accent`: #2563eb (blue-600)
- `accent-hover`: #1d4ed8

---

### Semantic

- success: #16a34a
- warning: #f59e0b
- error: #dc2626

---

### Dark Mode

- `bg-primary`: #0b0b0c
- `bg-secondary`: #111113
- `text-primary`: #f9fafb

---

## 4. Typography

### Font

- Default: system-ui
- Fallback: Inter

---

### Scale

| Token   | Size | Weight |
| ------- | ---- | ------ |
| h1      | 24px | 600    |
| h2      | 20px | 600    |
| h3      | 18px | 500    |
| body    | 16px | 400    |
| caption | 14px | 400    |
| small   | 12px | 400    |

---

### Rules

- Line height: 1.5
- No negative letter-spacing
- Avoid ultra-thin fonts (300 rarely used)

---

## 5. Spacing System

Base: 4px

| Token | Value |
| ----- | ----- |
| xs    | 4px   |
| sm    | 8px   |
| md    | 12px  |
| lg    | 16px  |
| xl    | 24px  |
| xxl   | 32px  |

---

### Layout Spacing

- Page padding: 16px
- Section gap: 24px
- Card padding: 16px

---

## 6. Layout

### Container

- Max width: 640px (mobile-first)
- Center aligned

---

### Structure

```id="layout"
Header
Content
Bottom Navigation (mobile)
```

---

### Grid

- Default: single column
- Tablet+: 2 columns
- Desktop: 3 columns max

---

## 7. Components

### 7.1 Button

Primary:

- bg: accent
- text: white
- height: 44px
- radius: 9999px (pill)

Secondary:

- bg: transparent
- border: 1px solid #e5e7eb
- text: primary

Disabled:

- bg: #e5e7eb
- text: #9ca3af

---

### 7.2 Card

- bg: white
- border: 1px solid #e5e7eb
- radius: 12px
- padding: 16px

No shadow.

---

### 7.3 Input

- height: 44px
- padding: 12px
- border: 1px solid #d1d5db
- radius: 10px

Focus:

- border: accent

---

### 7.4 List Item

- height: 56px
- padding: 12px 16px
- border-bottom: 1px solid #f1f1f1

---

### 7.5 Bottom Navigation (Mobile)

- height: 60px
- fixed bottom
- max 5 items
- icon + label

---

## 8. Interaction Rules

- No hover dependency

- Use only:
  - opacity change (0.8)
  - slight scale (0.98)

- Transition: 150ms ease

---

## 9. Icon System

- Use: Lucide / Heroicons
- Size:
  - 16px (inline)
  - 20px (default)
  - 24px (nav)

---

## 10. Responsive

### Breakpoints

- sm: 640px
- md: 768px
- lg: 1024px

---

### Behavior

- Mobile: single column
- Tablet: split layout
- Desktop: centered narrow UI (NOT full-width)

---

## 11. Dark Mode

Rules:

- Always supported
- Same structure, inverted colors
- Avoid pure black/white contrast

---

## 12. Do / Don’t

### Do

- Use spacing to separate sections
- Keep screens simple
- Limit actions per screen

---

### Don’t

- Don’t use shadows
- Don’t use gradients
- Don’t overuse colors
- Don’t create new components per project

---

## 13. Design Checklist

Before shipping:

- [ ] Mobile usability verified
- [ ] Tap targets ≥ 44px
- [ ] No unnecessary UI elements
- [ ] Consistent spacing
- [ ] Dark mode works
