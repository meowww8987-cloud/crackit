---
Task ID: 1
Agent: main (Super Z)
Task: Wire assignment-as-separate-column flow into AddTargetSheet + SyllabusTab so users can pick specific assignments per chapter (mirroring how lectures are picked), each becoming its own target linked to the specific assignment. Also update the syllabus "+ To Today" assignment button to open AddTargetSheet pre-filled instead of silently creating a chapter-level target.

Work Log:
- Read existing AddTargetSheet.tsx (573 lines), SyllabusTab.tsx assignment pop block, syllabus store + targets store + types.ts to understand the data flow.
- Confirmed: assignments already exist as `ChapterAssignment` on `Chapter.assignments[]`, and the syllabus store already exposes `addAssignment`/`incrementAssignmentDone` etc. — no schema migration needed.
- Added optional `assignmentId?: string` field to `Target` in `src/lib/types.ts` (with comment explaining: when present, target-done sync increments THAT assignment instead of the first one).
- Updated `src/lib/store/targets.ts` `toggleDone`: the Assignment branch now dispatches `target-done-sync` with `assignmentId: target.assignmentId || null`.
- Updated `src/lib/store/syllabus.ts` `target-done-sync` listener: it now destructures `assignmentId` from event detail and, when present, calls `incrementAssignmentDone(chapterId, matchedAssignmentId)` instead of always using `assignments[0].id`. Falls back to legacy behaviour when `assignmentId` is null/missing/doesn't match any chapter assignment.
- Rewrote `AddTargetSheet.tsx`:
  - Added `prefill?: { subject, chapterId, activity }` prop — when set, skips Step 1, lands the user directly on Step 2 with the prefilled chapter + activity.
  - Added `selectedAssignmentIds: Set<string>` state + `availableAssignments` memo + `toggleAssignment`/`selectAllAssignments` helpers (mirror the lecture equivalents).
  - Added `isAssignmentAdded(aId)` helper that scans today's targets for the matching assignmentId (mirrors `isLectureAdded`).
  - Updated `toggleAssignment`/`selectAllAssignments`: picking any assignment auto-locks activity to `Assignment`; deselecting the last one reverts to `Lecture` (so the lectures picker reappears).
  - Rewrote `handleSubmit`: when `isAssignment` and `selectedAssignmentIds.size > 0`, it creates one Target per picked assignment, each linked via `assignmentId`. Falls back to chapter-level target when no specific assignment is picked.
  - Rendered a separate "ASSIGNMENTS" picker section in Step 2 (after LECTURES), always visible once a chapter is selected — empty-state hint shown when chapter has no assignments. Multi-select with the same checkbox + ADDED-check + doneCount-badge pattern as lectures.
  - Updated Step 3 summary card to show `N asg` badge alongside the `N lec` badge.
  - Locked the Activity picker in Step 3 (disabled all options except Assignment) whenever any assignments are picked — because assignment targets are inherently Assignment activity.
  - Hid the Custom Topic input when any assignments are picked (each assignment target uses its own name as the topic).
  - Updated footer button labels: `Next (N selected)` and `Add N Target(s)` now count lectures + assignments.
- Updated `SyllabusTab.tsx`:
  - Imported `AddTargetSheet` from `@/components/study/AddTargetSheet`.
  - Added `addTargetPrefill` state.
  - Rewrote the "+ To Today" button onClick in the assignment pop to `setAddTargetPrefill({ subject, chapterId, activity: 'Assignment' })` instead of silently creating a chapter-level target via `addTarget({...})`.
  - Rendered `<AddTargetSheet prefill={addTargetPrefill} ... />` at the bottom of SyllabusTab.
  - Removed the now-unused `useTargets((s) => s.addTarget)` selector (kept `useTargets` import because `todayTargets` still uses it).
  - Removed the unused `getLearnedExpectedMinutes` import (the `addTarget` call that used it was the only consumer in this file).
- Verified: `npx next build` succeeds; TypeScript type-check reports no errors in the changed files; ESLint reports only the 4 pre-existing errors (set-state-in-effect in two places, require-imports in targets.ts) — confirmed by stash→lint→pop that none are caused by these changes.

Stage Summary:
- Two-way assignment linkage now exists end-to-end:
  * AddTargetSheet → user picks specific assignment(s) from a chapter → each becomes a Target with `assignmentId`.
  * Targets store → `toggleDone` → dispatches `target-done-sync` with `assignmentId`.
  * Syllabus store → listener → `incrementAssignmentDone(chapterId, assignmentId)` for the matching assignment only (no more "always first assignment" behaviour).
- SyllabusTab's "+ To Today" button now opens AddTargetSheet pre-filled with the chapter + Assignment activity, so the user gets expected-time selection AND can pick which specific assignment(s) to add — matching the same flow as lectures ("hold and expected time and then add" as the user described).
- AddTargetSheet's prefill prop is reusable — future entry points (e.g., long-press on a chapter card, lecture "+ To Today" buttons) can use the same mechanism.
- Files changed: `src/lib/types.ts`, `src/lib/store/targets.ts`, `src/lib/store/syllabus.ts`, `src/components/study/AddTargetSheet.tsx`, `src/components/tabs/SyllabusTab.tsx`. Build passes.
