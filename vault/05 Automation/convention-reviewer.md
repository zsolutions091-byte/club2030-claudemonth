---
title: convention-reviewer
aliases:
  - מבקר מוסכמות
tags:
  - automation
  - claude
  - subagent
---

# 🤖 convention-reviewer

> [!info] קובץ
> `.claude/agents/convention-reviewer.md`

## תפקיד

Code review סמנטי של שינויים אחרונים — תפקידה המרכזי לבדוק את 2 ה-invariants הסמנטיים: [[Audit Log]] ו-[[Hebrew Errors]]. מחזיר checklist עם ✅/⚠️/❌, **לא חוסם** (advisory).

> [!tip] חלוקת אחריויות
> [[Convention Check Hook]] מטפל בתיקיית בדיקות דטרמיניסטיות (soft delete, `'use server'`, path alias) — convention-reviewer מתמקד בסמנטיקה בלבד.

## שתי ה-Invariants הסמנטיות (ראשוניות)

> [!tip] כאן הערך האמיתי של הסוכן
> grep לא יכול לשפוט נכונות פילטר או שלמות audit — אלו דורשים קריאת הקוד.

| # | Invariant | איפה לבדוק |
|---|---|---|
| 1 | [[Soft Delete]] — נכונות פילטר `deletedAt: null` בכל read של Task/Project/Tag (כולל חריגים מוצדקים כמו `restoreX`) | `src/lib/actions/*.ts` |
| 2 | [[Audit Log]] — `TaskEvent` בכל mutation על Task **עם סוג ה-event הנכון** (`STATUS_CHANGED` ≠ `UPDATED` וכו') | `src/lib/actions/tasks.ts` |

## שלוש ה-Checks הדטרמיניסטיות (Pre-screened by Hook)

> [!info] בדיקות אוטומטיות
> ה-[[Convention Check Hook]] (Stop hook) סורק אלו סטטית ב-`src/lib/actions/`+`src/lib/validators/` — convention-reviewer מאשר אותן אך אינו צריך להשקיע בהן חשיבה:

| # | Check | ביצוע |
|---|---|---|
| 3 | [[Hebrew Errors]] — אין `throw new Error('<אנגלית>')` | Hook: regex match |
| 4 | `'use server'` בשורה הראשונה של קובץ action | Hook: regex match |
| 5 | Path alias `@/*` (לא relative imports) | Hook: regex match |

## מתי להפעיל

> [!example] טריגרים מפורשים
> עברית: "תבדוק", "code review", "סיימתי feature"
> אנגלית: "review my changes", "verify conventions", "check the action I added"

> [!tip] הפעלה פרואקטיבית
> אחרי שסוכן אחר (או main Claude) סיים לכתוב action / לשנות שאילתת Prisma / להשלים feature שנוגע ב-`src/lib/`.

## פלט טיפוסי

> [!example] Checklist לדוגמה
> ```
> ✅ 1. Soft delete: snoozeTask filters deletedAt: null
> ✅ 2. Audit log: TaskEvent UPDATED נכתב ל-dueDate
> ❌ 3. Hebrew error: 'Task not found' should be 'המשימה לא נמצאה'
> ✅ 4. 'use server' present
> ✅ 5. Uses @/lib/db
> ```

## איפה הוא לא רץ

> [!info] לא חוסם
> הסוכן הוא advisory בלבד. הפלט שלו מוצג ל-main Claude/למשתמש, אבל אין hook שעוצר commit. החלטות על "האם לתקן" — של המשתמש.

## גלגול עתידי

> [!todo]
> אפשר בעתיד להמיר חלק מהבדיקות ל-ESLint custom rules — `'use server'`, `@/` imports, חיפוש regex של אנגלית ב-`throw new Error`. אבל הם לא מחליפים את הסוכן — הוא קורא את הדיף ולוקח החלטות סמנטיות (האם המשימה הזו באמת צריכה event).

ראה גם: [[Subagents]] · [[Conventions]]
