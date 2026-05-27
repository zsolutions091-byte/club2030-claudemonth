---
title: Tag
aliases:
  - תגית
tags:
  - model
  - domain/tag
  - phase/1
status: schema-only
phase: 1
---

# Tag

תיוג רוחבי של [[Task|משימות]] — חוצה פרויקטים.

> [!info] קובץ
> `prisma/schema.prisma` (Tag model)

> [!warning] סטטוס
> ה-schema קיים והוא מלא, אבל **אין UI** עדיין — ב-`Sidebar.tsx` כתוב "תגיות בקרוב". אין גם actions ב-`src/lib/actions/`. הרחבה ב-Sprint 3.

## שדות

| שדה | טיפוס | הערה |
|---|---|---|
| `id` | `String` cuid | |
| `name` | `String` | `@unique` — אין שתי תגיות עם אותו שם |
| `color` | `String` | HEX, default `#E63CA8` (magenta) |
| `createdAt` | `DateTime` | |
| `deletedAt` | `DateTime?` | [[Soft Delete]] |

## חיבור למשימות

חיבור N:M דרך [[TaskTag]]:

```prisma
model Tag {
  tasks  TaskTag[]
  // ...
}
```

ראה [[TaskTag]] לפרטי טבלת הקישור.

## כשנוסיף UI

> [!todo] לסיים ב-Sprint 3
> - [ ] `tagCreateSchema` ב-`validators/`
> - [ ] `src/lib/actions/tags.ts` עם create/update/softDelete (Pattern B — בלי TaskEvent)
> - [ ] רכיב TagPicker בטופס משימה
> - [ ] תצוגה לפי תגית ב-sidebar (סינון סלקטיבי)
> - [ ] `revalidatePath('/all')` בכל mutation

ראה גם: [[Task]] · [[TaskTag]]
