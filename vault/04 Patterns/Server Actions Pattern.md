---
title: Server Actions Pattern
aliases:
  - דפוס Server Actions
tags:
  - pattern
  - architecture
---

# Server Actions Pattern

כל הכתיבה ל-DB עוברת דרך **Next.js server actions** ב-`src/lib/actions/`. אין REST API.

## חוקי ברזל

> [!important] שלוש מוסכמות שכל action חייב לכבד
> 1. לקרוא ל-Zod validator מ-`src/lib/validators/` — לעולם לא לסמוך על input
> 2. לעטוף את הכתיבה ב-`prisma.$transaction` ((רק) ב-Pattern A — כולל יצירת [[TaskEvent]])
> 3. לקרוא ל-`revalidatePath('/all')` לפני שמחזירים

> [!warning] `'use server'`
> חייב להיות בראש כל קובץ ב-`src/lib/actions/`. חסר → exception ב-runtime.

## שני ה-Patterns

> [!example] Pattern A — Task-side (עם [[Audit Log]])
> ```ts
> 'use server'
> 
> export async function updateTask(id: string, rawInput: unknown) {
>   const input = taskUpdateSchema.parse(rawInput)
> 
>   const existing = await prisma.task.findUnique({ where: { id } })
>   if (!existing || existing.deletedAt) throw new Error('המשימה לא נמצאה')
> 
>   // ... build `next` and `events` from diff
> 
>   const task = await prisma.$transaction(async (tx) => {
>     const updated = await tx.task.update({ where: { id }, data: next })
>     for (const ev of events) {
>       await tx.taskEvent.create({
>         data: { taskId: id, type: ev.type, actor: 'USER', payload: ev.payload },
>       })
>     }
>     return updated
>   })
> 
>   revalidatePath('/all')
>   return task
> }
> ```
> משמש לכל פעולה על [[Task]]. ראה `src/lib/actions/tasks.ts`.

> [!example] Pattern B — Project-side (ללא audit, עם business validation)
> ```ts
> 'use server'
> 
> export async function softDeleteProject(id: string) {
>   const activeTasks = await prisma.task.count({
>     where: { projectId: id, deletedAt: null, status: { not: 'DONE' } },
>   })
>   if (activeTasks > 0) {
>     throw new Error(`לא ניתן למחוק פרויקט עם ${activeTasks} משימות פעילות. ארכב במקום.`)
>   }
> 
>   await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } })
>   revalidatePath('/all')
>   return { id }
> }
> ```
> משמש לפעולות על [[Project]] (ולעתיד [[Tag]]). אין `prisma.$transaction` כי אין audit log לכתוב.

## חוק LOGGED_FIELDS

ב-`tasks.ts:13`:

```ts
const LOGGED_FIELDS = [
  'title',
  'description',
  'dueDate',
  'startDate',
  'priority',
  'projectId',
] as const
```

> [!important] אילו שדות יוצרים `UPDATED` event
> רק שינוי באחד מהם → `UPDATED` event. שדות אחרים (`dueHasTime`, `estimatedMinutes`) נשמרים אבל לא מתועדים.
>
> שינוי `status` יוצר `STATUS_CHANGED` ייעודי (לא `UPDATED`) — PRD §4.10.

## שגיאות

תמיד בעברית. ראה [[Hebrew Errors]].

```ts
throw new Error('המשימה לא נמצאה')
throw new Error('פרויקט לא יכול להיות הורה של עצמו')
throw new Error(`עומק היררכיה מקסימלי הוא ${MAX_DEPTH} רמות`)
```

## איפה לא להשתמש

> [!warning] לא לכתוב משם:
> - **Components** — אם רכיב צריך לכתוב, הוא מקבל את ה-action כ-prop ומעביר ל-`<form action={...}>` או קורא דרך `useTransition`
> - **API routes** — אין REST API. היחידים תחת `/api/` הם ה-webhooks ל-Phase 2
> - **Page components ישירות** — קוראים אקטיבית רק ב-mutation event (form submit, button click)

ראה גם: [[Conventions]] · [[Audit Log]] · [[server-action-builder]]
