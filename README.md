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

Workspace surface hierarchy uses a cool neutral canvas with white cards/controls, clearer input borders and brand-tinted table headers. PR filters/actions share one shadcn Card toolbar; bulk commands appear after selection. Shared button feedback uses 180ms ease-out hover/press transforms, with 240ms header/toolbar/tab entry motion. Reduced-motion disables entry animation and button transforms. These patterns are recorded in AGENTS.md for subsequent UI work; no animation dependency was added.

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
- PR printing opens an isolated A4 requisition preview and calls the browser print dialog (including user-managed Save as PDF). PR data remains mock; other document print/export actions remain UI-only unless separately implemented.

## Factory branding and Login

### Combined factory navigation

`src/lib/constants/navigation.ts` consolidates the verified iCON, iTech and iFoam sidebar inventory into 30 canonical menu items grouped by operation. Legacy labels for the same intake, material requisition, internal production order and production-report workflows are represented once; factory/site variants belong inside the canonical workspace rather than separate menus. Implemented links stay within the template. Unimplemented modules show **เร็วๆนี้** and an inline explanation rather than a fabricated route or a link to production. This consolidation changes navigation only: it does not merge distinct business documents, integrations or access rules.

### Visual polish pass

The shared UI now uses an enterprise/minimal hierarchy informed by ui-ux-pro-max: a dark neutral navigation rail, light workspace, clearer page/section headings, coordinated card/table/filter spacing, and a framed Login form. Factory primary/accent configuration remains unchanged. The search's marketing hero recommendation was rejected because it does not fit the ERP workspace; no generated design-system output was persisted.

Thai typography uses a self-hosted Noto Sans Thai variable font from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/notosansthai), with the SIL Open Font License retained in `public/fonts/OFL-NotoSansThai.txt`. No font requests to a third-party service are needed at runtime. Mobile targets and reduced-motion handling are defined in shared CSS.

Checks for this pass: the two focused Node test files passed **9 tests**; `git diff --check` passed. Login and Dashboard were visually reviewed at 1440×900 and 375×812, with mock entry, mobile Sheet, desktop collapse/expand and Gold branding save/restore exercised. The existing dev server at localhost:3002 was reused; the attempted second dev server at 3010 exited without replacing it. No production build, lint, typecheck, full E2E suite or real integration check ran. This is not an exhaustive accessibility or all-workflow certification.

Open **ตั้งค่า** on Login or the sidebar to navigate to the full **/settings** page (not a modal). **ตั้งค่าโรงงาน** configures factory name, short name, logo, primary color and an optional desktop Login background image. PNG/JPEG/WebP images are limited to 512 KB each, validated and stored browser-locally; old branding records remain compatible. Saving updates branding without changing business pages. **ตั้งค่าผู้ใช้** edits fictional users, departments, roles, active status and explicit per-user module visibility, with a saved visibility summary. Roles/departments do not implicitly grant modules. User edits live only in page memory and reset when leaving; no accounts are created, no user data is stored and no routes/API are protected. This is NOT real access control. iTech users and iCON permissions were read-only behavioral references; no reference UI source was copied.

- Defaults and presets: `src/lib/branding.ts`; the initial factory is Ionflow Factory / IF.
- Browser persistence: only `{ factoryName, shortName, logoDataUrl, loginImageDataUrl, primaryColor }` in `ionflow.factory-branding.v1`. No password, token, account details or business data is stored.
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

## Purchase requisitions (PR) demo

Routes `/pr`, `/pr/new`, `/pr/[prId]`, `/pr/[prId]/edit` use shared shadcn patterns. PR state and its audit events live in `PRProvider` for the current app session only; reload resets them. Other existing module workflows are unchanged.

- Drafts may be incomplete but reject invalid dates, non-positive quantities, negative/invalid prices and mismatched mock master data. Submission requires complete fields. Quantities support four decimal places, prices two.
- Mock requester/department, warehouse, product/unit and supplier selectors maintain matching names/codes. The actor switcher has been removed. Commands use the fixed mock administrator shown by the template, with no real authentication or production authorization. The assigned approver remains document metadata; production must enforce authenticated permissions on the server rather than trust a client-side actor name.
- Estimated amounts use exclusive demo VAT 7%, rounded per line to satang. Missing prices remain incomplete; known subtotal is labelled partial. Mixed units are never summed together.
- Workflow: draft/rejected → pending → approved → partial/full demo PO → closed. Negative actions require reasons. Cancelling an approved/partial PR stops further ordering but preserves existing demo PO records; it does not cancel POs.
- Related demo POs track ordered/remaining quantities and forbid oversupply. These are allocations for UI testing, not a real PO module or supplier order.
- Copy creates a new draft with zero ordered quantities and no inherited approval history. Delete is draft-only, with session audit retained and document number reserved. Stale editor revisions cannot overwrite newer changes. Bulk actions validate every selected record before applying any changes.
- PR list create/view/edit actions use shared shadcn Dialog with the existing editor/detail components and callbacks; direct routes remain available. Official shadcn Checkbox supports row selection and checked/mixed/select-all-current-page states. Page size sits beside bottom pagination. Browser printing uses isolated iframe `srcDoc`, escaped content, restrictive CSP, no scripts and an A4 requisition layout using current branding, items, totals and signature placeholders; it never labels PR as PO. Real printer output is user-managed. Excel export remains a mock preview. Import uses a predefined fictional example, rejects duplicate references, never reads an Excel file and never overwrites an existing PR.
- PR create/edit/workflow/delete events appear in `/audit_log` with actor and before/after fields until reload. Other module actions are not recorded.

Focused verification: `node --test scripts/pr-workflow.unit.test.mjs scripts/audit-log.unit.test.mjs scripts/sidebar-menu.contract.test.mjs`. No new dependencies, APIs, database, credentials or cloud resources were added.

## Audit snapshots

Open `/audit_log` or **ประวัติการแก้ไข** in the sidebar. Search by actor/document/summary, combine action/module/user/date filters, paginate, and inspect read-only before/after snapshots. Dates use Asia/Bangkok; both date endpoints are inclusive. Fictional fixtures in `src/lib/mock-data/audit-log.ts` are combined with in-memory PR events only. No audit API, persistence, real user data, or credentials are included.

“Old projects” / “โปรเจคเก่า” means iCON (`ionflow-icon`), iTech (`ionflow-itech`), and iFoam (`ionique-ifoam`), used as read-only references.

Focused check: `node --test scripts/audit-log.unit.test.mjs scripts/sidebar-menu.contract.test.mjs`.

## BOM formula UI demo

Open `/bom` from **สูตรผสมวัตถุดิบ**. The isolated `BOMProvider` owns masters, versioned formulas, ingredients, packaging, defaults, timestamps and per-formula demo history. Shared shadcn dialogs keep the header/close control visible while the body scrolls. Search, metadata filters, pagination and normal/loading/empty demo modes use existing Factory patterns.

## Production execution demo

The Production menu has four canonical destinations: `/bulk-production-orders`, `/bom`, `/production-reports` and `/production-receipts`. **ใบสูตรผลิต** is issued and printed inside a saved production order, where it snapshots the active BOM version and calculated material quantities; it is not a second formula master. **คลัง BOM** was removed as a duplicate destination—future hierarchy/where-used needs belong inside `/bom`.

`ProductionFlowProvider` keeps the mock order → formula snapshot → actual report → output receipt chain consistent across client navigation. Reports own actual output/material usage and do not post stock. Only confirmation in `/production-receipts` commits a WIP/FG `RECEIPT` to the shared in-memory Stock Ledger, rejects over-receipt, uses an idempotent operation ID, and locks confirmed receipts. All production-flow data still resets on full reload and is not a backend workflow.

- Normalized master codes and per-master versions are unique. Existing version identities are locked; new versions are separate records. RAW_MATERIAL/SUB_MATERIAL masters are components, not formula parents, matching iCON.
- Defaults must belong to the master and be ACTIVE. Changing defaults never changes other formula statuses. Confirmed deletion rejects formula/default/component references; there is no cascade.
- Quantities and batch sizes must be finite and positive. At least one ingredient is required, packaging is optional, and duplicate components within a group or missing/self references are rejected. No stock deduction or multi-level explosion.
- Excel selection displays the filename only. Loading sample data uses fictional fixtures, not file contents. Preview reports duplicate codes/versions and row errors; confirmation atomically adds valid selected rows to BOM state without overwrites. No real file parser or upload.
- State survives modal switches while `/bom` remains mounted, but resets on navigation away or reload. No unrelated providers, APIs, database, auth or production integration was changed.

Focused check: `node --test scripts/bom.unit.test.mjs scripts/sidebar-menu.contract.test.mjs`.

## Integration boundaries

Settings now includes **แผนก/ฝ่าย** and **คลังสินค้า** tabs. Both use shared shadcn tables, search/type/status filters, inline add/edit forms, active/inactive controls and confirmed deletion. Mock records live in `src/lib/mock-data/master-settings.ts`; changes survive tab switches only while Settings remains mounted. These new catalogs are not yet wired to PR or user-assignment options and have no backend/persistence. Focused validation check: `node --test scripts/master-settings.unit.test.mjs`.

Backend integration: **not implemented**.
Database/migrations: **not implemented**.
Deployment: **not performed**.
Commit/push/PR: **not performed**.
iCON, iTech, iFoam and Sales Hub: **not modified by this task**.

Deferred: real API adapters, authentication/permissions, document creation and persistence, actual file upload/download/printing/export, workflow business rules, protected attachment URLs, database, event/outbox workers, settings, deployment and production hardening.

Suggested commit message: `feat(factory-ui): build reusable factory interface with shadcn`.
