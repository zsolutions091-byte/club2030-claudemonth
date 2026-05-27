---
title: Project Overview
aliases:
  - סקירת פרויקט
tags:
  - overview
---

# Project Overview

> [!quote] מתוך CLAUDE.md
> מערכת ניהול משימות אישית (single-user). בשלב מאוחר יותר תחובר ל-Green API לשליחת תזכורות בוואטסאפ על משימות פתוחות.

## מי המשתמש

**אדם יחיד** — לא multi-tenant. אין user table, אין session management. מי שיש לו את סיסמת ה-Basic Auth מקבל גישה מלאה (ראה [[Authentication]]).

## מה המערכת עושה

> [!success] Phase 1
> - יצירה, עריכה, ארכוב ומחיקה (רכה) של [[Task|משימות]]
> - ארגון לפי [[Project|פרויקטים]] (היררכיה עד 3 רמות) ולפי [[Tag|תגיות]]
> - 4 ראוטים שמציגים את אותן המשימות בחיתוכים שונים: [[All]], [[Inbox]], [[Today]], [[Week]]
> - לוג שינויים מלא דרך [[TaskEvent]] — `STATUS_CHANGED`, `UPDATED`, `COMPLETED`, ...

> [!warning] Phase 2 — מתוכנן, טרם מומש
> תזכורות וואטסאפ ([[Reminder]]) + תגובה אינטראקטיבית (`done`/`snooze`/`delete`) דרך Green API. הזרימה ב-[[Roadmap#Phase 2 — WhatsApp Integration (תכנון)]].

## מגבלות מודעות

> [!warning] מה לא נתמך
> - Multi-user / שיתוף משימות
> - Mobile-first responsive (כרגע desktop-first, RTL)
> - Real-time sync בין מכשירים (הכל server-side, ללא WebSocket)
> - Offline mode

## עקרונות עיצוב

1. **עברית בכל מקום** — UI, הודעות שגיאה ב-server ([[Hebrew Errors]]), placeholders. לא מתרגמים לאנגלית.
2. **RTL מובנה** — `dir="rtl"` ב-`<html>`, `DirectionProvider` של Base UI.
3. **Soft delete בלבד** — [[Soft Delete|`deletedAt`]], לעולם לא DELETE פיזי.
4. **כל שינוי מתועד** — [[Audit Log]] דרך `TaskEvent`.
5. **Server-first** — כתיבה רק דרך [[Server Actions Pattern|server actions]], אין REST API.

ראה גם: [[Tech Stack]] · [[Conventions]] · [[Roadmap]]
