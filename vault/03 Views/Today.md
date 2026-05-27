---
title: Today
aliases:
  - היום
  - /today
tags:
  - view
  - phase/1
  - placeholder
status: placeholder
route: /today
---

# Today — היום

> [!warning] Placeholder
> `src/app/(views)/today/page.tsx` — רק טקסט "תיבנה ב-Sprint 2".

## מה התצוגה צריכה להציג

> [!info] חוק עסקי
> משימות שצריך לטפל בהן **היום**:
> 1. `dueDate <= end of today` ועדיין לא DONE/CANCELLED, **או**
> 2. `startDate <= today` ועדיין לא הושלמה, **או**
> 3. הוחמצו (`dueDate < today` ועדיין לא DONE) — מועלות לראש

> [!example] השאילתה המתוכננת
> ```ts
> const startOfToday = startOfDay(new Date())
> const endOfToday = endOfDay(new Date())
> 
> prisma.task.findMany({
>   where: {
>     deletedAt: null,
>     archivedAt: null,
>     parentTaskId: null,
>     status: { notIn: ['DONE', 'CANCELLED'] },
>     OR: [
>       { dueDate: { lte: endOfToday } },
>       { startDate: { lte: endOfToday } },
>     ],
>   },
>   orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }],
> })
> ```
> שימוש ב-`date-fns` (כבר בעצים — `startOfDay`, `endOfDay`).

## תכנון UX

> [!todo]
> - [ ] חלוקה לקבוצות: **הוחמצו** (אדום) · **היום** · **התחלה היום**
> - [ ] empty state עם quick-add inline

ראה גם: [[All]] · [[Week]] · [[Inbox]]
