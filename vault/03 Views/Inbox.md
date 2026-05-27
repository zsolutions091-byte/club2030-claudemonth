---
title: Inbox
aliases:
  - תיבת נכנסים
  - /inbox
tags:
  - view
  - phase/1
  - placeholder
status: placeholder
route: /inbox
---

# Inbox — תיבת נכנסים

> [!warning] Placeholder
> `src/app/(views)/inbox/page.tsx` הוא רק טקסט: "תיבת ה-Inbox תיבנה ב-Sprint 2". אין שאילתה ל-DB.

## מה התצוגה צריכה להציג

> [!info] חוק עסקי
> משימות **ללא [[Project]]** **וללא `dueDate`** — הן עדיין לא תויקו ולא תוזמנו, ועומדות לטיפול ידני.

> [!example] השאילתה המתוכננת
> ```ts
> prisma.task.findMany({
>   where: {
>     deletedAt: null,
>     archivedAt: null,
>     parentTaskId: null,
>     projectId: null,
>     dueDate: null,
>   },
>   orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
> })
> ```

## פעולות עתידיות

> [!todo] לסיים ב-Sprint 2
> - [ ] להעתיק את מבנה [[All]] עם השאילתה הסגורה
> - [ ] בעת drag-out מ-Inbox לפרויקט → `updateTask({ projectId })`
> - [ ] בעת קביעת תאריך → `updateTask({ dueDate })`
> - [ ] empty state יפה ("תיבת הנכנסים ריקה ✨")

ראה גם: [[All]] · [[Today]] · [[Week]] · [[Roadmap]]
