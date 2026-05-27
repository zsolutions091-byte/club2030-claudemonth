---
title: Hebrew Errors
aliases:
  - הודעות שגיאה בעברית
tags:
  - pattern
  - i18n
---

# Hebrew Errors

> [!important] חוק
> כל הודעת שגיאה שמגיעה מהשרת (`throw new Error(...)`, `z.string().min(1, 'יש להזין כותרת')`) תמיד בעברית. **אסור** לתרגם לאנגלית.

## למה

ה-UI כולו בעברית. הודעות שגיאה הן חלק מה-UI — מופיעות ב-toasts (sonner), בטפסים מתחת לשדה, או בדיאלוגים. אנגלית באמצע מסך עברי שוברת את החוויה.

## דוגמאות

> [!example] מ-`src/lib/actions/tasks.ts`
> ```ts
> throw new Error('המשימה לא נמצאה')
> ```

> [!example] מ-`src/lib/actions/projects.ts`
> ```ts
> throw new Error(`עומק היררכיה מקסימלי הוא ${MAX_DEPTH} רמות`)
> throw new Error('פרויקט לא יכול להיות הורה של עצמו')
> throw new Error(`לא ניתן למחוק פרויקט עם ${activeTasks} משימות פעילות. ארכב במקום.`)
> ```

> [!example] מ-`src/lib/validators/task.ts`
> ```ts
> z.string().trim().min(1, 'יש להזין כותרת').max(500, 'כותרת ארוכה מדי')
> z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'תאריך לא תקין')
> ```

> [!example] מ-`src/lib/validators/project.ts`
> ```ts
> z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'צבע HEX לא תקין')
> ```

## איפה כן באנגלית

> [!info] שתי חריגות
> 1. **`src/proxy.ts`** — תגובות HTTP פנימיות (`'Auth required'`, `'Forbidden'`, `'Server misconfigured: ...'`). אלה לא מגיעות ל-UI — הן headers/body של תגובת status. אין שם משתמש שיקרא אותן בדפדפן (browser בעצמו מעלה את ה-Basic Auth prompt).
> 2. **לוגים מהשרת** (`console.error(...)`) — הם לטרמינל של המפתח, לא לעיני המשתמש. כתוב באנגלית כי כך נוח יותר ב-stack traces.

## מספרים בהודעות

```ts
throw new Error(`עומק היררכיה מקסימלי הוא ${MAX_DEPTH} רמות`)
```

לא להתעמק במאצ׳ אינגליש-עברית סביב מספר. כתוב כמו דובר עברית טבעי.

## בדיקה ב-`convention-reviewer`

ה-subagent [[convention-reviewer]] בודק שכל `throw new Error(...)` בקבצי `src/lib/actions/` מכיל מילה בעברית. שגיאה באנגלית עוברת בודק → תיתפס ב-review.

ראה גם: [[Conventions]] · [[Server Actions Pattern]] · [[convention-reviewer]]
