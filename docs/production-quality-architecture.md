# Production Quality Inspection — mock architecture

Status: mock-only UI. Database, QA approval, inventory release and Excel integration are **PROPOSED / NOT IMPLEMENTED**.

## Ownership and reference evidence

One shared module owns inspection documents and observations, not production receipts, BOM masters or inventory. The `/production-quality` route uses the existing QC menu. A single ProductionQualityProvider in the Factory Layout holds session records; navigation retains saved records, browser reload restores fictional fixtures. There are no APIs, browser storage or database connections.

Business references read locally: iTech and iFoam `qc_organic_fertilizer` types, header/form table, calculation section in page, machine times, signer roles, print layout and API payloads; iFoam migration 004 was read as text only. No reference implementation or styles were copied. iCON has no equivalent organic QC profile here.

| Canonical            | iTech                 | iFoam                                |
| -------------------- | --------------------- | ------------------------------------ |
| profile              | ITECH / โรงงานกาญ 1   | IFOAM / โรงงานกาญ 3                  |
| documentNumber       | doc                   | doc_no                               |
| formula.lotCode      | lot                   | lot_no                               |
| productionLine       | T1, T2, T4            | F1, F2, F3                           |
| dryer A, four points | S2 ทดสอบ 1/3, 2/4     | ท่ออบ 1/2, 3/4                       |
| dryer B, six points  | S5 ทดสอบ 1/2/3, 4/5/6 | ท่ออบ 1/2, 3/4, 5/6                  |
| dust choices         | น้อย / กลาง / มาก     | ฝุ่นปานกลาง / ฝุ่นเยอะ / ฝุ่นเยอะมาก |

Profile labels and lines are explicit module configuration, not invented shared Master Data IDs. Real Site/Line identity mapping needs approval. A saved document's profile cannot change. Changing an unsaved profile asks confirmation before clearing incompatible line/dust values; numeric data, temperature groups, notes and formula rows remain.

## Canonical model and validation

Inspection has a stable internal ID, scoped display documentNumber, profile, local calendar inspectionDate, site/line, stable-ID formula/Lot/calculation rows, typed per-metric/per-slot readings with notes, machine times/stops, four signer roles, recordStatus, disposition and timestamps. Pure CRUD clones nested edited data. Document numbers are unique within a profile after trim/case normalization. Repeated save updates by ID. Missing updates/deletes fail explicitly.

All 16 metrics are represented. Numeric: moisture, density, 5 mm / 2 mm / tray percentages, inverter, hardness. Duration: solubility. Multi-point temperatures: A/B independent arrays. Text: configured dust choices. Boolean: BIGBAG marking, amino, IMO, coating, operator presence; null is uninspected, false is an explicit failed observation.

Input decimals retain text while editing so empty stays missing and malformed input is visible. Save rejects non-finite/malformed/negative numbers, more than three decimal places and percentages above 100. Other numbers use a defensive ceiling of 1,000,000,000, not a QC acceptance specification. Reference numeric storage uses three decimals. Scientific notation, commas and signed values are intentionally unsupported. Only an explicit `-` in **5 mm sieve** means zero, matching the verified calculation code; dash in other numeric metrics is invalid. No missing cells are filled with zero.

Duration input is `mm:ss` (1–3 minute digits, seconds 00–59), converted to seconds for averages. Display rounds the average to the nearest second, never treats `01:30` as decimal minutes. Temperature points use the same nonnegative, three-decimal validation; incomplete groups remain incomplete and warn.

Legacy matrix actively warns when an observed slot lacks dust; its current temperature-completeness helper returns true (older stricter implementation is commented out). This module surfaces incomplete temperature coverage as an informational warning, not a new recording/approval gate. At least one complete A or B group resolves the coverage warning. Explicit failed Boolean checks also warn, never set document-level approval.

## Calendar, calculations and machines

Production-day slots are fixed: 09,10,11,13,14,15,16,17,18,19,20,21,22,23,01,02,03,04,05,06,07. After-midnight slots belong to the following calendar day. There is no 12:00 or 00:00 sampling slot. A 23:00–02:00 range includes 23:00,01:00,02:00; reverse ranges that cross the next production-day boundary are rejected. Extra slots are deduplicated in canonical order. Formula calculations are attached by row ID, so removing a formula cannot shift another formula's configuration.

Seven averages use actual valid observations in selected slots only. Selected-slot count is not measured-value count. No valid samples means missing. Formula ranges may overlap intentionally: each formula's summary is independent; aggregate yearly documents and slots are deduplicated. Formula-specific yearly views use that formula's selected slots; without a configured range observations cannot be attributed to that formula and are excluded. All-formula yearly views count each observed slot once. Year/month filter the document's calendar date, not UTC posting dates. Drafts are excluded. Only compatible numeric/duration metrics are aggregated; dust and differently labelled temperature groups are not merged.

Machine HH:mm entries are interpreted relative to machine start (or work start, then 09:00 fallback) for a single production day. Stop/restart/reason must be complete together. Equal, reversed, overlapping/duplicate stop intervals or intervals beyond workStop are rejected. Cross-midnight intervals such as 23:30–00:15 are valid. No downtime totals or operating-efficiency formula is invented. More-than-one-day machine operation needs a future dated interval model.

## Lifecycle, UI, printing

DRAFT allows missing required document fields and absent observations, but rejects invalid entered data/partial formula pairs. RECORDED requires header, a complete formula/Lot and at least one observation. Recorded documents may be edited, not silently downgraded to draft. Disposition is always NOT_EVALUATED. No approval, rejection, digital signature or stock release is implied by signers or recording.

The form retains edits when switching local views. Opening another document/new form asks before discarding edits. Saved data persists across Factory navigation; unsaved editor data is local and is not autosaved across leaving the route. Dialog headers, close buttons and footer actions stay outside scrollable detail/print bodies. A slot selector supports focused mobile editing; dense tables scroll internally. Existing shared control motion/focus/reduced-motion behavior is reused.

Print uses an escaped, script-free HTML document inside a sandboxed iframe, existing branding and browser printing. Matrix pages split at seven slots on A4 landscape; machine records, per-formula summaries, signers and notes follow. Long content may flow to continuation pages; this is not generated PDF or a regulated fixed form. All text is escaped; only validated raster data-URL logos are accepted. No copied reference logos or premium assets.

## Future boundaries — PROPOSED / NOT IMPLEMENTED

- Production Receipt may reference inspection ID, without letting an inspection own stock receipt posting.
- QA disposition needs approved specifications by metric/profile/product, authenticated actor, permissions, audit/version history and explicit transitions. No pass rate/compliance score until these are defined.
- Inventory QC_HOLD release needs an independently authorized action, exact Lot/position quantities, single posting owner and idempotency. Existing Inventory Step 4 contracts are untouched.
- Excel adapter should map legacy doc/doc_no, lot/lot_no, temperature text arrays, numeric conventions and time slots into this canonical model; preview/validation and duplicate policy must precede import. No XLSX parsing/export or new dependencies are included.
- Outstanding decisions: actual master Site/Line IDs, approved numeric/specification limits, duration migration for legacy decimal minute-second encodings, formula-specific sample ownership when ranges overlap, formal QA lifecycle, long-running machine dates, official print sign-off format.

Verification uses only Production Quality and Sidebar focused Node tests and whitespace diff checks. This mock implementation does not demonstrate production authorization, compliance or database readiness.
