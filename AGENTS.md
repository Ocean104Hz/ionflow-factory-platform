<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Factory UI component policy

- Use installed official shadcn/ui primitives for every UI control/pattern, wrapped by shared Ionflow components where needed. Do not build competing primitives in features.
- Use shadcn Sidebar, Collapsible, Progress, Avatar, Table, Button and Input instead of hand-written equivalents.
- Standard HTML remains appropriate for structural/semantic layout (main, nav, headings, lists and links), not to replace an available UI primitive.
- Preserve branding tokens, semantic status colors, mock-only workflows and accessibility.
- Add missing primitives from the official registry; inspect and preserve customized primitives rather than overwriting them.
- Use subtle shared transitions and transform feedback for interactive controls and content entry when useful (roughly 180–240ms, ease-out). Preserve layout stability, avoid continuous/decorative motion, and disable scaling/entry motion for prefers-reduced-motion. Reuse centralized motion/theme tokens instead of per-page effects.

## UI Form Completeness Verification

Whenever creating or modifying a form based on an existing business document or reference form:

1. Build an authoritative field checklist from the reference.
2. Check every required visible input, selection, conditional field, and informational note.
3. Verify the connection between UI controls, form state, validation, save, edit, and detail/print views.
4. Run a focused form completeness regression check.
5. Report missing, intentionally changed, and unverified fields explicitly.
6. Never claim a form is complete based only on domain/unit test results.
7. Keep verification scoped to the changed form; do not run full repository tests by default.
