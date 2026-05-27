---
title: Tech Stack
aliases:
  - מחסנית
tags:
  - overview
  - reference
---

# Tech Stack

> [!danger] Next.js 16 — קוראים את ה-docs לפני שינוי
> `AGENTS.md` בשורש הריפו מזהיר: *"This is NOT the Next.js you know"*. APIs/conventions שונים מ-Next.js 14. לפני שינויים ב-routing/middleware — קרא את `node_modules/next/dist/docs/`.

## Framework

| חלק | גרסה | הערה |
|---|---|---|
| Next.js | **16.2** | App Router + Turbopack |
| React | 19.2 | server components, async pages |
| TypeScript | 5 | `strict: true` |

> [!info] מה השתנה ב-Next.js 16
> - `middleware.ts` → `proxy.ts` (ראה [[Authentication]])
> - `searchParams` ב-pages הוא `Promise` (`const sp = await searchParams`)

## Database

| חלק | גרסה | הערה |
|---|---|---|
| Prisma | **7.8** | Prisma 7, לא 5/6 |
| `@prisma/adapter-better-sqlite3` | 7.8 | adapter חובה ב-Prisma 7 |
| `better-sqlite3` | 12.9 | SQLite native binding |

> [!example] Prisma 7 — נתיב מותאם
> ```ts
> generator client {
>   provider = "prisma-client"  // ← לא "prisma-client-js"
>   output   = "../src/generated/prisma"
> }
> ```
> הקליינט נוצר ל-`src/generated/prisma/`, לא ל-`@prisma/client`. ייבוא תמיד דרך `import { prisma } from '@/lib/db'`. ראה `src/lib/db.ts`.

## UI Layer

| חלק | גרסה | תפקיד |
|---|---|---|
| Tailwind CSS | 4 | utility-first |
| shadcn/ui | 4 | פרימיטיבים ב-`src/components/ui/` |
| `@base-ui/react` | 1.4 | פרימיטיבים נוספים (`DirectionProvider`) |
| `lucide-react` | 1.14 | אייקונים |
| `next-themes` | 0.4 | dark mode (default dark) |
| `react-day-picker` | 9 | בוחר תאריכים בעברית |
| `sonner` | 2 | toasts |

## Forms & Validation

| חלק | תפקיד |
|---|---|
| `zod` 4 | [[Server Actions Pattern|server validation]] + טייפים בקליינט |
| `react-hook-form` 7 | טפסים בקליינט |
| `@hookform/resolvers` 5 | חיבור zod ↔ rhf |

## Auth

[[Authentication|Basic Auth single-user]] ב-`src/proxy.ts`. אין NextAuth, אין session store. סיסמה ב-`.env`.

## Future — Phase 2

> [!todo] Green API
> טרם הותקן. כשנגיע — לקוח HTTP מותאם תחת `src/lib/whatsapp/` ו-webhook handlers תחת `src/app/api/webhooks/green-api/`.

ראה גם: [[Conventions]] · [[File Map]]
