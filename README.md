# Ionflow Factory UI

Phase 1 reusable factory interface. Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui (Radix) + lucide-react. **All records, organizations, people, IDs, dates, and images are fictional demo data.**

## Run locally

```powershell
cd "D:\Program Files\Project\ionflow-factory-platform"
npm run dev
```

Open the localhost URL printed by Next.js. The root redirects to `/login`.
No environment variables, credentials, database, or authentication are required.

## Pages

| Route | Implementation |
| --- | --- |
| /login | Branded mock Login, password visibility, mock recovery dialog, demo entry |
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
    factory/             shell, patterns, demo-provider, branding-provider/editor/logo, dialogs, gallery, item-table, timeline
  features/
    dashboard/
    production-orders/
    delivery-orders/
    invoices/
    products/
    documents/           shared delivery/invoice list pattern
    login/               mock Login only, outside the factory shell
  lib/
    constants/status.ts
    formatters/
    mock-data/
    utils.ts
    branding.ts          defaults, storage validation, logo restrictions, theme derivation
public/demo/              three original local SVG illustrations
scripts/
  factory-ui.contract.test.mjs
  factory-branding.unit.test.mjs
```

## Shared UI standard

- `src/lib/branding.ts`: centralized `FactoryBranding` defaults and theme presets. New factories change this configuration rather than individual business pages.
- `app/globals.css`: one light theme using semantic tokens; branding derives primary/foreground/accent/ring values globally, including portaled dialogs. Status success/warning/danger tones stay semantic.
- `components/ui`: generated shadcn primitives, following the [official installation conventions](https://ui.shadcn.com/docs/installation/manual).
- `components/factory/patterns.tsx`: PageHeader, SectionCard, InfoRow/InfoGrid, StatusBadge, FilterBar, FactoryDataTable, Pagination, EmptyState, LoadingState, ErrorState, back/refresh actions.
- `FormDialog`: labeled fields, required trimmed reasons, numeric validation, local error messages, modal focus management.
- `ConfirmDialog`: shared AlertDialog confirmation.
- `AttachmentGallery`: local image previews; PDF is an explicitly labeled demo document card, not a real PDF.
- `DemoProvider`: typed in-memory state shared across navigation. Reloading the browser resets changes. No localStorage or persistence.
- Price changes do not retroactively alter amounts stored in existing mock order items.
- Refresh only confirms reading the local demo state; it does not fetch or reset the state.
- Print/export are explicitly UI-only confirmation actions. They do not print, generate, or download business files.

## Factory branding and Login

### Visual polish pass

The shared UI now uses an enterprise/minimal hierarchy informed by ui-ux-pro-max: a dark neutral navigation rail, light workspace, clearer page/section headings, coordinated card/table/filter spacing, and a framed Login form. Factory primary/accent configuration remains unchanged. The search's marketing hero recommendation was rejected because it does not fit the ERP workspace; no generated design-system output was persisted.

Thai typography uses a self-hosted Noto Sans Thai variable font from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/notosansthai), with the SIL Open Font License retained in `public/fonts/OFL-NotoSansThai.txt`. No font requests to a third-party service are needed at runtime. Mobile targets and reduced-motion handling are defined in shared CSS.

Checks for this pass: the two focused Node test files passed **9 tests**; `git diff --check` passed. Login and Dashboard were visually reviewed at 1440×900 and 375×812, with mock entry, mobile Sheet, desktop collapse/expand and Gold branding save/restore exercised. The existing dev server at localhost:3002 was reused; the attempted second dev server at 3010 exited without replacing it. No production build, lint, typecheck, full E2E suite or real integration check ran. This is not an exhaustive accessibility or all-workflow certification.

Open **ปรับแต่งโรงงาน** on Login or the sidebar. Configure factory name, short name, logo and primary color; choose a preset or a custom six-digit hex color. Saving updates Login, sidebar, topbar, navigation, buttons, focus styling and selected tabs without changing feature pages.

- Defaults and presets: `src/lib/branding.ts`; the initial factory is Ionflow Factory / IF.
- Browser persistence: only `{ factoryName, shortName, logoDataUrl, primaryColor }` in `ionflow.factory-branding.v1`. No password, token, account details or business data is stored.
- Logo: PNG/JPEG/WebP, up to 512 KB, decoded in the browser; no SVG, external URL, or upload request.
- Invalid/corrupted storage falls back safely. If browser storage is blocked/full, customization works in memory and the editor reports that it cannot persist.
- Reset restores the default branding. Browser-local configuration is a demo convenience, not deployment configuration or protected tenant settings.
- Initial server HTML uses default branding; saved browser branding is restored after hydration. A brief default-theme flash can occur.
- Desktop sidebar collapses to an icon rail with accessible labels/tooltips. Mobile Sheet remains fully expanded regardless of the desktop state. Collapse state is not persisted.
- `/login` is outside the factory shell. The supplied email/password are fictional; submitting resets the fields and navigates to `/dashboard` without reading/saving credentials or checking a real account.
- Forgot-password opens an explanatory mock dialog; it sends no email. The user menu can return to Login, but this is not a real logout.
- Business routes remain directly accessible; **no authentication or route guard exists**.

## Responsive and accessibility behavior

Desktop: collapsible fixed sidebar, topbar, shared page spacing, multi-column cards and form grids.
Tablet/mobile: Sheet navigation, stacked cards/forms and wrapped action buttons.
Enterprise tables keep a minimum readable width and scroll horizontally inside a keyboard-focusable region.
Radix dialogs provide keyboard/focus behavior; all modal content has titles/descriptions.
Inputs have associated labels; icon-only controls have accessible names.
Status tones use the semantic palette, not per-page hexadecimal colors.

## Verification record

No component/browser UI framework is installed. The existing narrow Node source-contract file and the new branding-logic tests use built-in Node tests and the already-installed TypeScript transpiler (not type checking).

| Check / command | Result |
| --- | --- |
| Inspect package.json, AGENTS.md, app sources, local Next.js routing/client guides | PASS — source inspection |
| `npx --yes shadcn@latest add button card badge input textarea select tabs dialog alert-dialog dropdown-menu sheet tooltip separator skeleton table label --yes` | PASS — 16 primitive files generated |
| `npm install class-variance-authority lucide-react tw-animate-css` | PASS — required primitive dependencies installed |
| `npx --yes prettier@3.6.2 --write app src scripts/factory-ui.contract.test.mjs components.json` | PASS — source formatting only; no tests/build/typecheck |
| `git diff --check` | PASS — no whitespace errors (Git reports LF/CRLF notices) |
| `rg -n '\\bany\\b\|fetch\\(\|process\\.env\|https?://' app src -g '*.ts' -g '*.tsx'` | PASS — no matches in application source |
| Component/browser UI tests | NOT RUN - no existing scoped UI test runner available |
| `node --test scripts/factory-ui.contract.test.mjs scripts/factory-branding.unit.test.mjs` | PASS — focused source/branding checks; sandbox spawn was blocked (EPERM), then rerun with approval |
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
13. Customize factory name/short name and choose Gold; verify Login, sidebar, topbar, buttons, focus and tabs update. Reload: branding remains while business state resets.
14. Upload an allowed small logo; reject SVG/oversized/corrupt files. Remove logo and restore defaults.
15. Collapse desktop sidebar, use icon tooltips and expand again; at mobile width, open Sheet and verify full labels.
16. Submit the mock Login, reveal/hide the dummy password, open mock recovery and return via the user menu. Verify no credential data appears in browser storage.

## Boundaries and Phase 2

Backend integration: **not implemented**.
Database/migrations: **not implemented**.
Deployment: **not performed**.
Commit/push/PR: **not performed**.
iCON, iTech, iFoam and Sales Hub: **not modified by this task**.

Deferred: real API adapters, authentication/permissions, document creation and persistence, actual file upload/download/printing/export, workflow business rules, protected attachment URLs, database, event/outbox workers, settings, deployment and production hardening.

Suggested commit message: `feat(factory-ui): build reusable factory interface with shadcn`.
