# Ionflow Factory UI

Phase 1 reusable factory interface. Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui (Radix) + lucide-react. **All records, organizations, people, IDs, dates, and images are fictional demo data.**

## Run locally

```powershell
cd "D:\Program Files\Project\ionflow-factory-platform"
npm run dev
```

Open the localhost URL printed by Next.js. The root redirects to `/dashboard`.
No environment variables, credentials, database, or authentication are required.

## Pages

| Route | Implementation |
| --- | --- |
| /dashboard | Summary cards, grouped statuses, recent orders, work queue |
| /production-orders | Applied filters, source tabs, standard columns, pagination, explicit loading/empty/error demos |
| /production-orders/po-01 | Eleven ordered detail sections, workflow, schedule proposal, images, masked driver, timeline |
| /production-orders/po-02 | Pending cancellation example; accept/reject with a reason |
| /delivery-orders | Filters and delivery document table |
| /delivery-orders/do-1 | Seven sections, edit draft shipping details, confirm/cancel dialogs |
| /invoices | Filters, tax totals, UI-only export action |
| /invoices/inv-1 | Five detail sections, discount/VAT/total, cancellation |
| /products | Product and price tabs, edit demo details, set/change prices |

Other mock IDs are available from their list tables. Unknown IDs show the not-found page.

## Structure

```text
app/
  layout.tsx, globals.css, page.tsx, not-found.tsx
  (factory)/
    layout.tsx, loading.tsx, error.tsx
    dashboard/
    production-orders/ + [productionOrderId]/
    delivery-orders/ + [deliveryOrderId]/
    invoices/ + [invoiceId]/
    products/
src/
  components/
    ui/                  16 installed shadcn primitives
    factory/             shell, patterns, demo-provider, dialogs, gallery, item-table, timeline
  features/
    dashboard/
    production-orders/
    delivery-orders/
    invoices/
    products/
    documents/           shared delivery/invoice list pattern
  lib/
    constants/status.ts
    formatters/
    mock-data/
    utils.ts
public/demo/              three original local SVG illustrations
scripts/
  factory-ui.contract.test.mjs
```

## Shared UI standard

- `app/globals.css`: one light theme using semantic tokens; change primary tokens to brand a future factory.
- `components/ui`: generated shadcn primitives, following the [official installation conventions](https://ui.shadcn.com/docs/installation/manual).
- `components/factory/patterns.tsx`: PageHeader, SectionCard, InfoRow/InfoGrid, StatusBadge, FilterBar, FactoryDataTable, Pagination, EmptyState, LoadingState, ErrorState, back/refresh actions.
- `FormDialog`: labeled fields, required trimmed reasons, numeric validation, local error messages, modal focus management.
- `ConfirmDialog`: shared AlertDialog confirmation.
- `AttachmentGallery`: local image previews; PDF is an explicitly labeled demo document card, not a real PDF.
- `DemoProvider`: typed in-memory state shared across navigation. Reloading the browser resets changes. No localStorage or persistence.
- Price changes do not retroactively alter amounts stored in existing mock order items.
- Refresh only confirms reading the local demo state; it does not fetch or reset the state.
- Print/export are explicitly UI-only confirmation actions. They do not print, generate, or download business files.

## Responsive and accessibility behavior

Desktop: fixed sidebar, topbar, shared page spacing, multi-column cards and form grids.
Tablet/mobile: Sheet navigation, stacked cards/forms and wrapped action buttons.
Enterprise tables keep a minimum readable width and scroll horizontally inside a keyboard-focusable region.
Radix dialogs provide keyboard/focus behavior; all modal content has titles/descriptions.
Inputs have associated labels; icon-only controls have accessible names.
Status tones use the semantic palette, not per-page hexadecimal colors.

## Verification record

No existing focused UI test runner or component test framework was found. None was installed.

| Check / command | Result |
| --- | --- |
| Inspect package.json, AGENTS.md, app sources, local Next.js routing/client guides | PASS — source inspection |
| `npx --yes shadcn@latest add button card badge input textarea select tabs dialog alert-dialog dropdown-menu sheet tooltip separator skeleton table label --yes` | PASS — 16 primitive files generated |
| `npm install class-variance-authority lucide-react tw-animate-css` | PASS — required primitive dependencies installed |
| `npx --yes prettier@3.6.2 --write app src scripts/factory-ui.contract.test.mjs components.json` | PASS — source formatting only; no tests/build/typecheck |
| `git diff --check` | PASS — no whitespace errors (Git reports LF/CRLF notices) |
| `rg -n '\\bany\\b\|fetch\\(\|process\\.env\|https?://' app src -g '*.ts' -g '*.tsx'` | PASS — no matches in application source |
| Component/browser UI tests | NOT RUN - no existing scoped UI test runner available |
| `node --test scripts/factory-ui.contract.test.mjs` | NOT RUN — newly added narrow source contract checks; not a component/browser runner |
| Build / lint / typecheck / E2E / coverage | NOT RUN — not authorized |
| Desktop/tablet/mobile visual inspection | NOT RUN — responsive classes implemented, browser appearance not verified |

The source contract file checks shell links/Sheet, Production Order columns and section order, semantic badge tones, table overflow and shared dialog structure. It does not prove runtime rendering, keyboard operation, or interaction correctness.

Dependency installation reported **5 high-severity audit findings** in the installed dependency tree. They were not investigated or auto-fixed in this UI phase; do not treat this template as production-ready.

### Manual review checklist

1. Open each list and navigate to a detail row and back. Check sidebar active state.
2. Production Orders: switch sources; filter by date, status and cancellation; paginate.
3. Select normal/empty/loading/error table demos; retry returns to normal.
4. In po-01 mark materials ready, approve, start production, mark completed, then ready for pickup. Verify state also updates the list/dashboard.
5. Open a negative action; submitting an empty or whitespace-only reason must not save. Escape/cancel must leave state unchanged.
6. Propose a completion/pickup date; pickup cannot precede completion.
7. Preview all local images; verify PDF shows a demo card and ID stays masked.
8. In po-02 accept/reject cancellation; verify decision details.
9. Edit/confirm/cancel a draft delivery order; cancel an invoice.
10. Set a price for DEMO-P003 and change another price; verify unchanged existing order amounts.
11. Review at 1440, 768 and 390 pixels. Check horizontal tables, mobile Sheet and stacked grids.
12. Reload the browser; all state must return to the centralized fixtures.

## Boundaries and Phase 2

Backend integration: **not implemented**.
Database/migrations: **not implemented**.
Deployment: **not performed**.
Commit/push/PR: **not performed**.
iCON, iTech, iFoam and Sales Hub: **not modified by this task**.

Deferred: real API adapters, authentication/permissions, document creation and persistence, actual file upload/download/printing/export, workflow business rules, protected attachment URLs, database, event/outbox workers, settings, deployment and production hardening.

Suggested commit message: `feat(factory-ui): build reusable factory interface with shadcn`.
