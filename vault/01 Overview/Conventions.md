---
title: Conventions
aliases:
  - מוסכמות
  - חוקי כתיבה
tags:
  - overview
  - reference
---

# Conventions

חמש מוסכמות שכל שינוי בקוד חייב לכבד. `convention-reviewer` רץ עליהן אחרי כל feature.

## 1. עברית בלבד בהודעות שרת

> [!example] תקין
> ```ts
> throw new Error('המשימה לא נמצאה')
> throw new Error(`עומק היררכיה מקסימלי הוא ${MAX_DEPTH} רמות`)
> ```

> [!failure] לא תקין
> ```ts
> throw new Error('Task not found')  // ❌ אנגלית
> ```

ראה [[Hebrew Errors]] לפירוט.

## 2. `'use server'` בראש כל קובץ actions

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
// ...
```

חסר → Next ירוץ ב-client → exception.

## 3. Path Alias `@/*`

`tsconfig.json`:
```json
"paths": { "@/*": ["./src/*"] }
```

> [!success] תקין
> ```ts
> import { prisma } from '@/lib/db'
> import { taskCreateSchema } from '@/lib/validators/task'
> ```

> [!failure] לא תקין
> ```ts
> import { prisma } from '../../../lib/db'  // ❌ relative path
> ```

## 4. Soft Delete — לעולם לא DELETE פיזי

ל-[[Task]], [[Project]], [[Tag]] יש `deletedAt`. כל query חייב לסנן:

```ts
prisma.task.findMany({
  where: { deletedAt: null, /* ... */ },
})
```

ראה [[Soft Delete]].

## 5. כל שינוי ב-Task — TaskEvent בתוך transaction

כל mutation ב-`tasks.ts` עוטף ב-`prisma.$transaction` ויוצרת [[TaskEvent]]:

```ts
await prisma.$transaction(async (tx) => {
  const updated = await tx.task.update({ where: { id }, data: next })
  await tx.taskEvent.create({
    data: { taskId: id, type: 'UPDATED', actor: 'USER', payload: '...' },
  })
})
```

ראה [[Server Actions Pattern]] ו-[[Audit Log]].

## בונוס: שני patterns מקבילים

> [!info] Task-side vs Project-side
> - **Task actions** (`tasks.ts`) — תמיד עם [[TaskEvent]] (Pattern A)
> - **Project actions** (`projects.ts`) — בלי audit log, אבל עם business validation (Pattern B)
> כשכותבים action חדש, צריך להחליט באיזה pattern. ראה [[Server Actions Pattern#שני ה-Patterns]].

## RTL & פונט

- `<html lang="he" dir="rtl">` ב-`src/app/layout.tsx`
- פונט [Heebo](https://fonts.google.com/specimen/Heebo) (`next/font/google`)
- `DirectionProvider direction="rtl"` עוטף את כל ה-Base UI primitives

## סדר ה-imports

לא נאכף ע"י ESLint, אבל מוסכמה רופפת:
1. React/Next/external
2. `@/lib/...`
3. `@/components/...`
4. relative (`./Foo`)
5. טייפים בסוף

ראה גם: [[Tech Stack]] · [[Server Actions Pattern]] · [[convention-reviewer]]
