---
title: TaskTag
aliases:
  - חיבור משימה-תגית
tags:
  - model
  - domain/junction
  - phase/1
status: schema-only
phase: 1
---

# TaskTag

טבלת קישור N:M בין [[Task]] ל-[[Tag]].

> [!info] קובץ
> `prisma/schema.prisma` (TaskTag model)

## שדות

| שדה | טיפוס | הערה |
|---|---|---|
| `taskId` | `String` | חלק מ-PK המשולב |
| `tagId` | `String` | חלק מ-PK המשולב |

```prisma
model TaskTag {
  taskId String
  tagId  String
  task   Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([taskId, tagId])
  @@index([tagId])
}
```

## הערות

> [!important] Cascade delete
> במחיקה פיזית של Task או Tag ה-rows ב-TaskTag ימחקו. אבל המערכת משתמשת ב-[[Soft Delete]], אז זה לא קורה בפועל ב-Phase 1 — TaskTag נשארת מאחוריה.

> [!tip] אינדקס
> ה-PK המשולב (`taskId, tagId`) משמש כאינדקס לכיוון Task→Tag. הוספנו `@@index([tagId])` לכיוון ההפוך (Tag→Task) — שליפת כל המשימות עם תגית.

ראה גם: [[Tag]] · [[Task]]
