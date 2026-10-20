# Organic Fertilizer Packaging Report — Phase 1 + 2

Status: **MOCK IMPLEMENTATION**. No APIs, database, inventory posting or QA approval. This report is distinct from Packing Summary and Packing Orders.

## Verified reference behavior

Read-only references: iTech/iFoam `packaging_report` types, page_client, form_table, signer roles, detail/history/print components and API payloads; Packing Summary reference types/UI and iTech reference-conflict code. iFoam migrations 005/039/040/041 were read as text only, never executed. No iCON profile is invented.

| Behavior                   | ITECH                                     | IFOAM                                                                       |
| -------------------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| Factory / allowed location | โรงงานกาญ 1                               | โรงงานกาญ 3                                                                 |
| SETs                       | One, multiple formula/Lot contexts        | Multiple, one primary context per SET                                       |
| Packing time               | Quarter-hour options across 24 hours      | Same quarter-hour options                                                   |
| Hourly QC sampling time    | Not used by original form                 | Dedicated field, also quarter-hour options in actual source                 |
| Remarks                    | Document-level                            | SET-level; canonical document note also retained                            |
| Signers                    | Inspector, QC officer, factory manager/QA | Inspector, packing machine operator, production manager, factory manager/QA |

The configured factories are mock profile identities, not shared Master Data site/warehouse IDs. No Master Data was changed. Stored documents cannot switch factory. An unsaved profile switch requires explicit confirmation before resetting all unsaved fields; opening a new/different report also confirms discard. Local view switching retains the draft editor. Unsaved editor changes are not autosaved across leaving the route.

## Canonical ownership and model

PackagingReport owns stable document ID, manual documentNumber, profile/location/calendar date, status, disposition, sets, document remarks, signers and timestamps. Display numbers are unique per factory after trim/case normalization, not immutable IDs.

PackagingSet has stable ID and sequential setNo, contexts, inspections, loadCells, comparisons, remarks. SET deletion renumbers display setNo only; nested IDs/references of remaining SETs are preserved. At least one SET remains. iTech does not expose unnecessary multi-SET controls.

PackagingContext keeps formula/name, production/packaging date, packaging type, nominal weight, unit, quantity and Lot. PackagingObservation references contextId inside its SET and records packing time, two kg weight samples, tri-state physical/code/sealing checks, optional moisture/water-solubility/dust, plus iFoam sampling time. Removing a referenced context is blocked rather than cascading its measurements.

`mapITechRows` is a typed business mapping: every legacy flat row retains its own context and observation. It never merges equal labels or different Lots/dates. Future import adapters must supply explicit source row IDs and handle conversions; no Excel/file processing is implemented.

## Measurements, dates and validation

Numeric inputs are stored as decimal strings. Blank stays blank, explicit zero stays zero, trailing zeros/entered decimal precision are retained. Scientific notation, signed negatives, commas, NaN and Infinity are rejected; values must also be representable as finite JavaScript numbers. Positive nominal weight/quantity/bag samples/Load Cell/scale readings are required where populated. Percentage observations use their natural 0–100 range, not a factory acceptance tolerance. No automatic PASS/FAIL is calculated from weight or scale difference, and no unit conversion occurs. Supported mock unit labels include kg/g/ton/lb and legacy กิโลกรัม/ตัน/Bag; legacy Bag-as-unit ambiguity requires future unit mapping review.

Water solubility remains the numeric legacy value (for example `1.30`) with an explicit legacy label. iTech form shows a minute placeholder but storage is numeric and has no reliable mm:ss contract. This module does not reinterpret it as 90 seconds, average it, or establish compliance limits. Future migration must confirm whether each factory used decimal minutes or an encoded minute-second convention.

Times are local HH:mm clock strings, never fabricated UTC instants. Packing and sampling choices follow the actual 15-minute legacy dropdowns. Every context has its own calendar production/packaging date; rows are not sorted or shifted across midnight automatically. Measurements that cross calendar days should use separate dated contexts (iTech) or SETs (iFoam). Load Cell/Master times are HH:mm. The historical four-hour Master comparison schedule is informational, not an enforced approval condition.

DRAFT permits missing fields/partial rows, while rejecting malformed entered numbers, dates, times, invalid references and duplicate times/IDs. RECORDED requires header, complete meaningful contexts and at least one valid inspection row in every SET, with positive weights. Optional Load Cell/Master rows must be complete when recording, or explicitly removed. iFoam sampling time is required when hourly test values are populated; tests may remain unmeasured. Null Boolean values remain uninspected, distinct from false. Individual false checks never approve or reject the document.

Lifecycle is DRAFT / RECORDED; disposition remains NOT_EVALUATED. Recorded documents can be edited but not downgraded to draft. Signer text is not authenticated electronic signature or QA authorization. CRUD validates before committing and rejects nonexistent updates/deletes without mutation.

## UI, session and print

Two local views: form and history. Existing Factory PageHeader/SectionCard, shadcn inputs/selects/tabs/dialogs, FactoryDataTable/Pagination/ConfirmDialog and theme tokens are reused. Forms and each SET grow naturally; no per-SET vertical scroll. Fields stack on mobile; only the history table scrolls horizontally. Detail/print dialogs retain their own single body viewport with header/close/footer outside the scroll area.

PackagingProvider mounts once at Factory Layout without reordering existing providers. It only owns in-memory packaging records; navigation keeps saves, full reload restores deterministic fictional fixtures. It does not import Inventory providers or commit operations. Production Quality and its matrix fixes remain untouched.

Print HTML is escaped, script-free, sandboxed, uses validated branding raster data URLs, A4 landscape and repeated document/SET/context table headers. Each context's observations are split into six-row groups. Load Cell and Master sections use twelve-row groups per SET, then signers/document remarks follow. All decimal strings remain unchanged. Long text wraps, tables can continue with repeated thead; no fixed page-height clipping. Physical printer/PDF output requires browser/device verification, not inferred from preview alone.

## Future integrations — PROPOSED / NOT IMPLEMENTED

- Packing Summary reference: PackagingReport ID, PackingSummary ID, factory scope, display document reference and linked status. Enforce one owner summary per report; changing links must be transactional and reject conflicts (legacy iTech reports HTTP 409). A summary may reference multiple compatible packaging reports. Revalidation and unlink/delete policy require approval.
- Excel Phase 3: map legacy flat rows and SET payloads, preserved decimal strings, null Boolean values and sampling time; provide validation/preview and duplicate-resolution rules before real parsing. No Excel libraries or nonfunctional import/export buttons are included.
- Real backend/stock integration: independent posting ownership, authenticated actors, factory scope, idempotency, audit history, exact Lot/item/unit mappings and explicit QA disposition. A packaging report alone must never imply stock consumption, receipt, conversion or release.
- Outstanding decisions: official numbering, real master/site IDs, package-unit normalization, water-solubility units/legacy encoding, approved bag/scale tolerances, formal QA transitions and official printer layout/signoff. None is guessed as production policy here.
