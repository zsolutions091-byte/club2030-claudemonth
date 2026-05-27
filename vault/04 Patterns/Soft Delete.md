---
title: Soft Delete
aliases:
  - מחיקה רכה
tags:
  - pattern
  - data
---

# Soft Delete

> [!important] חוק
> אסור למחוק רשומות פיזית (`prisma.X.delete`). כל "מחיקה" היא עדכון `deletedAt: new Date()`.

## אילו מודלים תומכים

| מודל | שדה | פעולה |
|---|---|---|
| [[Task]] | `deletedAt` | `softDeleteTask` ([[Server Actions Pattern|Pattern A]] — מייצרת `DELETED` event) |
| [[Project]] | `deletedAt` | `softDeleteProject` ([[Server Actions Pattern|Pattern B]] — חוסם אם יש משימות פעילות) |
| [[Tag]] | `deletedAt` | בעתיד — אין UI עדיין |

> [!warning] ללא soft delete
> [[TaskEvent]], [[TaskTag]], [[Reminder]], [[OutboundMessage]], [[InboundMessage]], [[Settings]] — אין להם `deletedAt`. ראה [[#למה לא לכולם]].

## כל query חייב לסנן

```ts
prisma.task.findMany({
  where: {
    deletedAt: null,           // ← חובה
    archivedAt: null,
    // ... שאר התנאים
  },
})
```

> [!failure] באג נפוץ
> שכחה של `deletedAt: null` → משימות מחוקות מופיעות ב-UI. `convention-reviewer` בודק את זה אחרי כל feature.

## מחיקה עם integrity check (Project)

```ts
const activeTasks = await prisma.task.count({
  where: { projectId: id, deletedAt: null, status: { not: 'DONE' } },
})
if (activeTasks > 0) {
  throw new Error(`לא ניתן למחוק פרויקט עם ${activeTasks} משימות פעילות. ארכב במקום.`)
}
```

[[Project]] מצפה שהמשתמש יארכב במקום למחוק אם עדיין יש פעילות פתוחה.

## למה לא לכולם

> [!info] Audit & junction tables
> - **TaskEvent** — immutable by design. אין עדכון, אין מחיקה.
> - **TaskTag** — junction table. אם הקשר נשבר (מסירים תגית) — מוחקים ושוב יוצרים.
> - **InboundMessage / OutboundMessage** — ראיות. שמירה לטווח ארוך, אבל אין סיבה למחוק רכה.

## עתיד — Hard delete מתוזמן

> [!todo]
> כדאי לתזמן job שמסיר רשומות `deletedAt < now() - 90 days` (פיזית). יישאר ל-Phase 2+.

ראה גם: [[Audit Log]] · [[Conventions]] · [[Server Actions Pattern]]
