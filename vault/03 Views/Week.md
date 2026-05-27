---
title: Week
aliases:
  - השבוע
  - /week
tags:
  - view
  - phase/1
  - placeholder
status: placeholder
route: /week
---

# Week — השבוע

> [!warning] Placeholder
> `src/app/(views)/week/page.tsx` — רק טקסט.

## מה התצוגה צריכה להציג

> [!info] חוק עסקי
> חלון של 7 ימים קדימה — היום + 6 הבאים. משימות עם `dueDate` בטווח הזה.

> [!example] השאילתה המתוכננת
> ```ts
> import { startOfDay, addDays, endOfDay } from 'date-fns'
> 
> const today = startOfDay(new Date())
> const weekEnd = endOfDay(addDays(today, 6))
> 
> prisma.task.findMany({
>   where: {
>     deletedAt: null,
>     archivedAt: null,
>     parentTaskId: null,
>     status: { notIn: ['DONE', 'CANCELLED'] },
>     dueDate: { gte: today, lte: weekEnd },
>   },
>   orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }],
> })
> ```

## תכנון UX

> [!todo]
> - [ ] קיבוץ לפי יום (`א'`, `ב'`, ... עברית מ-`date-fns/locale/he`)
> - [ ] גרירה בין ימים → `updateTask({ dueDate })`
> - [ ] "הצג גם ללא dueDate" toggle (עוקף את ה-where)

ראה גם: [[All]] · [[Today]] · [[Inbox]]
