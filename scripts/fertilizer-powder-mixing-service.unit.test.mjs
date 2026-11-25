import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import ts from "typescript";

// Load actual application modules. Only the DB, session lookup, repository
// operations, and NextResponse transport are replaced. No external connection.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
function compile(path, imports = {}) {
  const result = ts.transpileModule(read(path), {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  });
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${path} failed transpilation`);
  let source = result.outputText.replace(/import\s+["']server-only["'];?/, "");
  for (const [specifier, url] of Object.entries(imports)) {
    const quoted = [`"${specifier}"`, `'${specifier}'`].find((value) => source.includes(value));
    assert.ok(quoted, `${path}: expected runtime import ${specifier}`);
    source = source.replaceAll(quoted, JSON.stringify(url));
  }
  return moduleUrl(source);
}

const stateUrl = moduleUrl(`export const state = {};`);
const { state } = await import(stateUrl);
const nextUrl = moduleUrl(`export const NextResponse = { json(data, init) { return Response.json(data, init); } };`);
const authUrl = compile("src/server/auth/auth-service.ts");
const authBoundaryUrl = compile("src/server/auth/auth-boundary.ts", { "./auth-service.ts": authUrl });
const authHttpUrl = compile("src/server/auth/auth-http.ts", {
  "next/server": nextUrl,
  "./auth-service.ts": authUrl,
  "./auth-boundary.ts": authBoundaryUrl,
});
const sessionUrl = moduleUrl(`import { state } from ${JSON.stringify(stateUrl)};
export async function readCurrentFactoryUser() { return state.user; }`);
const dbUrl = moduleUrl(`import { state } from ${JSON.stringify(stateUrl)};
export function getDevelopmentDatabase() {
  return { async readOnly(work) { return work({ async query(sql, values = []) {
    state.catalogQueries.push({ sql, values });
    if (state.catalogError) throw state.catalogError;
    return state.masterRows;
  } }); } };
}`);
const configUrl = compile("src/server/database/config.ts");
const repoSourceUrl = compile("src/server/fertilizer-powder-mixing/mixing-repository.ts", {
  "../database/database": dbUrl,
});
const repoUrl = moduleUrl(`import { state } from ${JSON.stringify(stateUrl)};
export { MixingConflictError } from ${JSON.stringify(repoSourceUrl)};
export function getMixingRepository() {
  state.repositoryRequests++;
  return state.repository;
}`);
const serviceUrl = compile("src/server/fertilizer-powder-mixing/mixing-service.ts", {
  "../auth/auth-service": authUrl,
  "../auth/server-auth": sessionUrl,
  "../database/database": dbUrl,
  "./mixing-repository": repoUrl,
});
const routeUrl = compile("app/api/fertilizer-powder-mixing/route.ts", {
  "next/server": nextUrl,
  "@/src/server/auth/auth-service": authUrl,
  "@/src/server/auth/auth-http": authHttpUrl,
  "@/src/server/database/config": configUrl,
  "@/src/server/fertilizer-powder-mixing/mixing-repository": repoUrl,
  "@/src/server/fertilizer-powder-mixing/mixing-service": serviceUrl,
});
const { mixingService: service, buildMixingCatalog, parseMixingInput, MixingValidationError } = await import(serviceUrl);
const { FactoryAuthError } = await import(authUrl);
const { MixingConflictError } = await import(repoUrl);
const { BackendError } = await import(configUrl);
const route = await import(routeUrl);

const id = "2c11aa33-34f2-4c68-94a7-c7ab5831c7dd";
const unitId = "9a1bf22a-3c7f-486f-ba46-56a5302be198";
const materialId = "f6e11ffb-1ab0-4af8-829d-4332a027370c";
const actor = { id: "2", displayName: "Test operator" };
const user = { ...actor, firebaseUid: "test-session", email: "test@example.invalid",
  roles: ["factory_admin"], modules: ["fertilizer_powder_mixing"] };
const master = (rowId, kind, code, name, typeId = "", active = true) => ({
  id: rowId, kind, code, payload: { id: rowId, kind, code, name, typeId, active },
});
const unit = () => master(unitId, "units", "UNIT-KG", "kg");
const material = () => master(materialId, "materials", "RM-01", "Material A", unitId);
const input = () => ({
  doc_no: "MIX-TEST", report_date: "2026-11-25", fertilizer: "Formula A", lot_no: "LOT-1",
  shift: "Day", location: "Plant", loader_no: "L1", mix_duration: 1.5,
  inspector: "", inspector_date: "", production: "", factory_qa: "",
  materials: [{ id: "m1", material_code: "RM-01", material_name: "Material A", lot_no: "L1", order_qty: 5, unit: "kg" }],
  mix_rounds: [{ id: "r1", round_date: "2026-11-25", shift: "Day", loader_load_count: "2", is_pass: null,
    operator_mixer: "Operator", supervisor: "Supervisor" }],
});
const record = (version = "1") => ({ ...input(), id, version,
  materials: input().materials.map((row) => ({ ...row, stock_balance: null })),
  masterRefs: {}, created_at: "2026-11-25T00:00:00.000Z", updated_at: "2026-11-25T00:00:00.000Z", updated_by: actor.displayName });

beforeEach(() => {
  state.user = structuredClone(user);
  state.masterRows = [material(), unit()];
  state.catalogQueries = [];
  state.catalogError = null;
  state.repositoryRequests = 0;
  state.calls = [];
  state.repository = {
    async list() { state.calls.push(["list"]); return [record()]; },
    async get(documentId) { state.calls.push(["get", documentId]); return documentId === id ? record() : null; },
    async create(payload, auditActor) { state.calls.push(["create", payload, auditActor]); return record(); },
    async update(documentId, version, payload, auditActor) {
      state.calls.push(["update", documentId, version, payload, auditActor]); return record("2");
    },
    async archive(documentId, version, auditActor) { state.calls.push(["archive", documentId, version, auditActor]); },
  };
});

const assertNoDatabase = () => {
  assert.equal(state.repositoryRequests, 0);
  assert.equal(state.catalogQueries.length, 0);
  assert.equal(state.calls.length, 0);
};
const validation = (field) => (error) => error instanceof MixingValidationError && error.field === field;
const authError = (status) => (error) => error instanceof FactoryAuthError && error.status === status;

test("catalog resolves active materials via payload.typeId to active units and never invents stock", () => {
  assert.deepEqual(buildMixingCatalog([material(), unit()]), [{
    material_id: materialId, material_code: "RM-01", material_name: "Material A",
    unit_id: unitId, unit_code: "UNIT-KG", unit: "kg", stock_balance: null,
  }]);
});

test("catalog rejects inactive, missing, inconsistent or ambiguous material references", () => {
  const inactive = material(); inactive.payload.active = false;
  const inactiveUnit = unit(); inactiveUnit.payload.active = false;
  const wrongId = material(); wrongId.payload.id = "different-id";
  const wrongKind = unit(); wrongKind.payload.kind = "materials";
  const wrongCode = material(); wrongCode.payload.code = "OTHER";
  const duplicate = master("second-material", "materials", "rm-01", "Material B", unitId);
  for (const rows of [[inactive, unit()], [material(), inactiveUnit], [material()],
    [wrongId, unit()], [material(), wrongKind], [wrongCode, unit()], [material(), duplicate, unit()]]) {
    assert.deepEqual(buildMixingCatalog(rows), []);
  }
});

test("every service operation requires authenticated module and factory_admin access before data access", async () => {
  const operations = [() => service.list(), () => service.get(id), () => service.catalog(),
    () => service.create(input()), () => service.update(id, { ...input(), version: "1" }),
    () => service.archive(id, { version: "1" })];
  for (const [identity, status] of [[null, 401], [{ ...user, modules: [] }, 403], [{ ...user, roles: [] }, 403]]) {
    state.user = identity;
    for (const operation of operations) await assert.rejects(operation(), authError(status));
    assertNoDatabase();
  }
});

test("list and get use the repository, validate document ID, and do not query the catalog", async () => {
  await assert.rejects(service.get("not-a-uuid"), validation("id"));
  assertNoDatabase();
  assert.equal((await service.list()).length, 1);
  assert.equal((await service.get(id)).id, id);
  assert.equal(await service.get("00000000-0000-0000-0000-000000000001"), null);
  assert.equal(state.catalogQueries.length, 0);
  assert.deepEqual(state.calls.map(([name]) => name), ["list", "get", "get"]);
});

test("catalog service reads settings_masters using the existing shared read-only boundary", async () => {
  const choices = await service.catalog();
  assert.equal(choices[0].material_id, materialId);
  assert.equal(state.repositoryRequests, 0);
  assert.equal(state.catalogQueries.length, 1);
  assert.match(state.catalogQueries[0].sql, /FROM foliar_fertilizer\.settings_masters/);
  assert.match(state.catalogQueries[0].sql, /WHERE kind IN \('materials', 'units'\)/);
  assert.deepEqual(state.catalogQueries[0].values, []);
});

test("invalid document fields, dates, numeric values and empty detail lists stop before database access", async () => {
  const cases = [
    ["doc_no", { ...input(), doc_no: " " }],
    ["report_date", { ...input(), report_date: "2026-02-30" }],
    ["report_date", { ...input(), report_date: "0000-01-01" }],
    ["inspector_date", { ...input(), inspector_date: "bad" }],
    ["mix_duration", { ...input(), mix_duration: -1 }],
    ["mix_duration", { ...input(), mix_duration: "1.5" }],
    ["materials", { ...input(), materials: [] }],
    ["mix_rounds", { ...input(), mix_rounds: [] }],
    ["materials.0.order_qty", { ...input(), materials: [{ ...input().materials[0], order_qty: 0 }] }],
    ["materials.0.order_qty", { ...input(), materials: [{ ...input().materials[0], order_qty: Infinity }] }],
    ["rounds.0.round_date", { ...input(), mix_rounds: [{ ...input().mix_rounds[0], round_date: "2026-04-31" }] }],
    ["rounds.0.loader_load_count", { ...input(), mix_rounds: [{ ...input().mix_rounds[0], loader_load_count: "0" }] }],
    ["rounds.0.is_pass", { ...input(), mix_rounds: [{ ...input().mix_rounds[0], is_pass: "pass" }] }],
    ["rounds.0.is_pass", { ...input(), mix_rounds: [{ ...input().mix_rounds[0], is_pass: undefined }] }],
  ];
  for (const [field, payload] of cases) await assert.rejects(service.create(payload), validation(field));
  assertNoDatabase();
});

test("duplicate row identities and excessive detail counts are rejected", async () => {
  for (const [field, payload] of [
    ["materials.1.id", { ...input(), materials: [input().materials[0], input().materials[0]] }],
    ["rounds.1.id", { ...input(), mix_rounds: [input().mix_rounds[0], input().mix_rounds[0]] }],
    ["materials", { ...input(), materials: Array.from({ length: 101 }, (_, i) => ({ ...input().materials[0], id: `m${i}` })) }],
  ]) await assert.rejects(service.create(payload), validation(field));
  assertNoDatabase();
});

test("optional signer fields, nullable duration and round results retain the domain contract", () => {
  for (const result of [null, true, false]) {
    for (const count of ["2", "\u0e04\u0e23\u0e1a", "\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a"]) {
      const data = parseMixingInput({ ...input(), mix_duration: null, inspector: undefined,
        mix_rounds: [{ ...input().mix_rounds[0], is_pass: result, loader_load_count: count }] });
      assert.equal(data.mix_duration, null);
      assert.equal(data.inspector, "");
      assert.equal(data.mix_rounds[0].is_pass, result);
      assert.equal(data.mix_rounds[0].loader_load_count, count);
    }
  }
});

test("create validates current master data, canonicalizes unit code, and ignores forged stock, audit and references", async () => {
  const payload = { ...input(), id: "forged", version: "999", updated_by: "forged", created_at: "forged",
    masterRefs: { fake: { id: "forged" } },
    materials: [{ ...input().materials[0], unit: "UNIT-KG", stock_balance: 999 }] };
  const saved = await service.create(payload);
  const [operation, validated, savedActor] = state.calls[0];
  assert.equal(operation, "create");
  assert.equal(saved.id, id);
  assert.deepEqual(savedActor, actor);
  assert.deepEqual(validated.materials, input().materials);
  assert.equal(Object.hasOwn(validated, "id"), false);
  assert.equal(Object.hasOwn(validated, "version"), false);
  assert.equal(Object.hasOwn(validated, "updated_by"), false);
  assert.equal(Object.hasOwn(validated, "created_at"), false);
  assert.equal(Object.hasOwn(validated.materials[0], "stock_balance"), false);
  assert.deepEqual(validated.masterRefs, { "unit:m1": { id: unitId, kind: "units", code: "UNIT-KG", name: "kg", value: "kg" } });
  assert.equal(state.catalogQueries.length, 1);
});

test("invalid material code, name, unit or inactive catalog prevents repository writes", async () => {
  for (const changed of [{ material_code: "UNKNOWN" }, { material_name: "Other" }, { unit: "ton" }]) {
    await assert.rejects(service.create({ ...input(), materials: [{ ...input().materials[0], ...changed }] }), validation("materials.0.material_code"));
  }
  state.masterRows[1].payload.active = false;
  await assert.rejects(service.create(input()), validation("materials.0.material_code"));
  assert.equal(state.repositoryRequests, 0);
  assert.equal(state.calls.length, 0);
});

test("update and archive require valid document UUID and exact bigint version and pass the authenticated actor", async () => {
  for (const version of [undefined, "0", "01", 1, "9223372036854775807", "9223372036854775808", "1.5"]) {
    await assert.rejects(service.update(id, { ...input(), version }), validation("version"));
    await assert.rejects(service.archive(id, { version }), validation("version"));
  }
  await assert.rejects(service.update("invalid", { ...input(), version: "1" }), validation("id"));
  await assert.rejects(service.archive("invalid", { version: "1" }), validation("id"));
  assertNoDatabase();
  await service.update(id, { ...input(), version: "1", id: "forged", updated_by: "forged" });
  await service.archive(id, { version: "2", actor: { id: "forged" } });
  assert.deepEqual(state.calls[0].slice(0, 3), ["update", id, "1"]);
  assert.deepEqual(state.calls[0][4], actor);
  assert.deepEqual(state.calls[1], ["archive", id, "2", actor]);
  assert.equal(state.catalogQueries.length, 1);
});

const csrf = "A".repeat(43);
const origin = "http://localhost:3000";
const basePath = "/api/fertilizer-powder-mixing";
function request(method = "GET", path = "", payload, options = {}) {
  const headers = { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", "x-csrf-token": csrf,
    ...options.headers };
  const body = options.rawBody !== undefined ? options.rawBody : (payload === undefined ? undefined : JSON.stringify(payload));
  const req = new Request(`${origin}${basePath}${path}`, { method, headers, body });
  req.nextUrl = new URL(req.url);
  req.cookies = { get(name) {
    return name === "ionflow_factory_csrf" ? { value: options.cookie ?? csrf } : undefined;
  } };
  return req;
}
async function checkResponse(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.ok, status >= 200 && status < 300);
  return body;
}

test("GET lists reports, reads by ID, serves catalog, and returns 404 for unknown reports", async () => {
  const listed = await checkResponse(await route.GET(request()), 200);
  assert.equal(listed.data[0].id, id);
  const one = await checkResponse(await route.GET(request("GET", `?id=${id}`)), 200);
  assert.equal(one.data.id, id);
  const choices = await checkResponse(await route.GET(request("GET", "?catalog=1")), 200);
  assert.equal(choices.data[0].unit_id, unitId);
  await checkResponse(await route.GET(request("GET", "?id=00000000-0000-0000-0000-000000000001")), 404);
  await checkResponse(await route.GET(request("GET", "?catalog=1&id=foo")), 400);
  await checkResponse(await route.GET(request("GET", "?id=x&id=y")), 400);
});

test("POST, PUT and DELETE call the service and return the CRUD response contract", async () => {
  const created = await checkResponse(await route.POST(request("POST", "", input())), 201);
  assert.equal(created.data.id, id);
  const updated = await checkResponse(await route.PUT(request("PUT", `?id=${id}`, { ...input(), version: "1" })), 200);
  assert.equal(updated.data.version, "2");
  const removed = await checkResponse(await route.DELETE(request("DELETE", `?id=${id}`, { version: "2" })), 200);
  assert.deepEqual(removed.data, { id });
  assert.deepEqual(state.calls.map(([name]) => name), ["create", "update", "archive"]);
});

test("mutation endpoints reject cross-origin requests and mismatched CSRF before database access", async () => {
  for (const method of ["POST", "PUT", "DELETE"]) {
    const path = method === "POST" ? "" : `?id=${id}`;
    for (const options of [
      { headers: { origin: "https://other.invalid" } },
      { headers: { "sec-fetch-site": "cross-site" } },
      { headers: { "x-csrf-token": "B".repeat(43) } },
      { cookie: "" },
    ]) await checkResponse(await route[method](request(method, path, { ...input(), version: "1" }, options)), 403);
  }
  assertNoDatabase();
});

test("route rejects malformed JSON, incorrect media type, oversized request and missing mutation ID", async () => {
  await checkResponse(await route.POST(request("POST", "", undefined, { rawBody: "{" })), 400);
  await checkResponse(await route.POST(request("POST", "", input(), { headers: { "content-type": "text/plain" } })), 400);
  await checkResponse(await route.POST(request("POST", "", undefined, { rawBody: JSON.stringify({ text: "x".repeat(12000) }) })), 400);
  await checkResponse(await route.POST(request("POST", "", input(), { headers: { "content-length": "12001" } })), 403);
  await checkResponse(await route.PUT(request("PUT", "", { ...input(), version: "1" })), 400);
  await checkResponse(await route.DELETE(request("DELETE", "", { version: "1" })), 400);
  assertNoDatabase();
});

test("route maps missing session and insufficient permissions to 401 and 403", async () => {
  state.user = null;
  await checkResponse(await route.GET(request()), 401);
  await checkResponse(await route.POST(request("POST", "", input())), 401);
  state.user = { ...user, roles: [] };
  await checkResponse(await route.GET(request("GET", "?catalog=1")), 403);
  await checkResponse(await route.DELETE(request("DELETE", `?id=${id}`, { version: "1" })), 403);
  assertNoDatabase();
});

test("route reports validation fields, stale versions and duplicate document conflicts", async () => {
  const rejected = await checkResponse(await route.POST(request("POST", "", { ...input(), doc_no: "" })), 400);
  assert.equal(rejected.field, "doc_no");
  state.repository.update = async () => { throw new MixingConflictError(); };
  await checkResponse(await route.PUT(request("PUT", `?id=${id}`, { ...input(), version: "1" })), 409);
  state.repository.archive = async () => { throw new MixingConflictError(); };
  await checkResponse(await route.DELETE(request("DELETE", `?id=${id}`, { version: "1" })), 409);
  state.repository.create = async () => { throw Object.assign(new Error("private SQL detail"), { code: "23505" }); };
  const duplicate = await checkResponse(await route.POST(request("POST", "", input())), 409);
  assert.doesNotMatch(duplicate.message, /private SQL detail/);
});

test("database and unexpected errors fail without leaking connection or SQL details", async (t) => {
  t.mock.method(console, "error", () => {});
  state.catalogError = new BackendError("DB_QUERY_FAILED");
  const dbError = await checkResponse(await route.GET(request("GET", "?catalog=1")), 503);
  assert.doesNotMatch(dbError.message, /DB_QUERY_FAILED/);
  state.catalogError = null;
  state.repository.list = async () => { throw new Error("private connection detail"); };
  const unknownError = await checkResponse(await route.GET(request()), 500);
  assert.doesNotMatch(unknownError.message, /private connection detail/);
});
