---
description: Full project-conventions review (5 invariants) via the convention-reviewer agent
argument-hint: "[file paths to scope — optional; defaults to recently changed src/lib files]"
---

Run a full convention review of the recent changes.

Context:
- This project is **not a git repository** — there is no `git diff`. Scope to the files in `$ARGUMENTS` if given; otherwise scope to the most recently modified files under `src/lib/actions/` and `src/lib/validators/` (use conversation context for what just changed; `ls -lt` those dirs if unsure).
- The 3 **deterministic** invariants — #3 Hebrew error strings, #4 `'use server'`, #5 path alias — are already pre-screened on every turn by the `convention-check` Stop hook (`.claude/hooks/convention-check.js`). Confirm them, but the real value of this command is the 2 **semantic** invariants a grep cannot judge: #1 soft-delete filter correctness and #2 audit-log completeness + correct `TaskEvent` type.

Launch the **convention-reviewer** agent on that scope and return its structured ✅/⚠️/❌ checklist verdict. If it reports any ❌ blocks, recommend the concrete fix (or invoking `server-action-builder`) before proceeding.
