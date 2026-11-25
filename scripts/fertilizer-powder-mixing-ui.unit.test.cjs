/* Focused UI interactions. Actual TSX compiled; React, provider and DOM are test doubles. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const base = path.join(process.cwd(), 'src/features/fertilizer-powder-mixing');
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('type' in value)) return [];
  return [value, ...nodes(value.props.children)];
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join('');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value && typeof value === 'object' ? text(value.props?.children) : '';
}
function find(tree, predicate) {
  const item = nodes(tree).find(predicate);
  assert.ok(item, 'Expected element not found');
  return item;
}
function button(tree, label) {
  return find(tree, (node) => ['button', 'Button'].includes(node.type) && text(node).trim() === label);
}
function makeRuntime(file, dependencies, confirm) {
  let cursor = 0;
  const state = [];
  const react = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
      return [state[slot], (value) => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
    },
    useRef(initial) {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = { current: initial };
      return state[slot];
    },
  };
  const visualModules = new Proxy({}, { get: (_, key) => String(key) });
  const customRequire = (specifier) => {
    if (specifier === 'react') return react;
    if (specifier === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    if (specifier === 'lucide-react' || specifier.startsWith('@/src/components/') || specifier.startsWith('./mixing-')) return visualModules;
    throw new Error('Unexpected import: ' + specifier);
  };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(base, file), 'utf8'), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  assert.equal((compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'window', compiled.outputText)(customRequire, mod, mod.exports, { confirm });
  return { render(name, props) { cursor = 0; return mod.exports[name](props); } };
}
class MixingValidationError extends Error {
  constructor(fields) { super(Object.values(fields)[0]); this.fields = fields; }
}
function fixture() {
  return { id: 'saved-1', version: '7', doc_no: 'MIX-1', report_date: '2026-11-25', fertilizer: 'Formula', lot_no: 'Lot', shift: 'Day', location: 'Plant', loader_no: 'L1', mix_duration: null, materials: [], mix_rounds: [], inspector: '', inspector_date: '', production: '', factory_qa: '', created_at: '', updated_at: '', updated_by: '' };
}
function listRuntime() {
  const record = fixture();
  const calls = { remove: [], copy: [], confirm: 0 };
  const provider = { records: [record], loading: false, busy: false, error: '', remove: async (id, version) => { calls.remove.push([id, version]); }, copy: async (id) => { calls.copy.push(id); } };
  let allow = false;
  const domain = {
    blankReport: (day, doc) => ({ ...fixture(), id: '', version: undefined, doc_no: doc, report_date: day }),
    emptyFilters: { search: '', from: '', to: '', shift: 'all', result: 'all' },
    filterReports: (records) => records,
    nextDocumentNumber: (_, doc) => doc,
    shifts: ['Day'], summarizeReport: () => ({ allPass: false, tone: 'warning', label: 'pending', passed: 0, failed: 0, pending: 1 }),
    validDate: () => true,
  };
  const runtime = makeRuntime('mixing-list.tsx', {
    './mixing-provider': { useMixing: () => provider }, './mixing-domain': domain,
    '@/src/lib/formatters': { date: (d) => d, dateTime: (d) => d },
  }, () => { calls.confirm++; return allow; });
  return { record, calls, provider, allowDiscard: () => { allow = true; }, render: () => runtime.render('MixingList') };
}
const editor = (tree) => find(tree, (node) => node.type === 'MixingForm');
const actions = (tree, record) => find(tree, (node) => node.type === 'FactoryDataTable').props.columns.find((column) => column.key === 'actions').render(record, 0);
const pressTab = (tree, label) => button(tree, label).props.onClick();
const formTab = 'แบบฟอร์มรายงานผสม';
const historyTab = 'ประวัติรายงานผสม';
const editAction = (tree, record) => find(actions(tree, record), (n) => n.type === 'Button' && String(n.props['aria-label']).startsWith('แก้ไข '));
const confirmAction = (tree, record) => find(actions(tree, record), (n) => n.type === 'ConfirmDialog' || n.type?.name === 'ConfirmDialog');
const status = (tree) => text(find(tree, (n) => n.props.role === 'status'));
test('form is the default tab and draft identity stays mounted while switching history and back', () => {
  const app = listRuntime(); let tree = app.render();
  assert.equal(button(tree, formTab).props['aria-pressed'], true);
  const initial = editor(tree); initial.props.onDirtyChange();
  pressTab(tree, historyTab); tree = app.render();
  assert.equal(button(tree, historyTab).props['aria-pressed'], true);
  assert.equal(editor(tree).key, initial.key);
  assert.equal(editor(tree).props.initial, initial.props.initial);
  pressTab(tree, formTab); tree = app.render();
  assert.equal(editor(tree).key, initial.key);
  assert.equal(editor(tree).props.initial, initial.props.initial);
  assert.equal(app.calls.confirm, 0);
});
test('history edit opens the inline editor only after dirty draft discard is accepted', () => {
  const app = listRuntime(); let tree = app.render();
  editor(tree).props.onDirtyChange(); pressTab(tree, historyTab); tree = app.render();
  editAction(tree, app.record).props.onClick(); tree = app.render();
  assert.equal(button(tree, historyTab).props['aria-pressed'], true);
  assert.equal(editor(tree).props.initial.id, '');
  assert.equal(app.calls.confirm, 1);
  app.allowDiscard(); editAction(tree, app.record).props.onClick(); tree = app.render();
  assert.equal(button(tree, formTab).props['aria-pressed'], true);
  assert.equal(editor(tree).props.initial.id, app.record.id);
  assert.notEqual(editor(tree).props.initial, app.record);
  assert.equal(find(tree, (n) => n.type === 'Dialog').props.open, false);
});
test('save callback closes the current editor and next form tab opens a fresh report', () => {
  const app = listRuntime(); let tree = app.render();
  editor(tree).props.onDirtyChange(); editor(tree).props.onSaved(); tree = app.render();
  assert.equal(button(tree, historyTab).props['aria-pressed'], true);
  assert.equal(nodes(tree).some((n) => n.type === 'MixingForm'), false);
  pressTab(tree, formTab); tree = app.render();
  assert.equal(editor(tree).props.initial.id, '');
  assert.equal(app.calls.confirm, 0);
});
test('deleting the document being edited is blocked while its draft is dirty', async () => {
  const app = listRuntime(); let tree = app.render();
  pressTab(tree, historyTab); tree = app.render();
  editAction(tree, app.record).props.onClick(); tree = app.render();
  editor(tree).props.onDirtyChange(); pressTab(tree, historyTab); tree = app.render();
  await confirmAction(tree, app.record).props.onConfirm();
  assert.deepEqual(app.calls.remove, []);
  assert.equal(editor(app.render()).props.initial.id, app.record.id);
});
test('form change marks the draft dirty; rejected save retains changed fields and accepted save notifies parent', async () => {
  let dirty = 0, saved = 0, fail = true;
  const submitted = [];
  const runtime = makeRuntime('mixing-form.tsx', {
    './mixing-provider': { useMixing: () => ({ save: async (row) => {
      submitted.push(row); if (fail) throw new MixingValidationError({ lot_no: 'required' });
    } }) },
    './mixing-domain': { MixingValidationError },
  });
  const props = { initial: fixture(), onSaved: () => saved++, onDirtyChange: () => dirty++ };
  let tree = runtime.render('MixingForm', props);
  find(tree, (n) => n.type === 'MixingHeader').props.onChange({ lot_no: 'updated' });
  tree = runtime.render('MixingForm', props);
  assert.equal(dirty, 1);
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(saved, 0);
  tree = runtime.render('MixingForm', props);
  assert.equal(find(tree, (n) => n.type === 'MixingHeader').props.row.lot_no, 'updated');
  assert.equal(find(tree, (n) => n.type === 'MixingHeader').props.errors.lot_no, 'required');
  fail = false; await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(saved, 1);
  assert.equal(submitted[1].lot_no, 'updated');
});
test('archive sends the displayed version; success appears only after API resolution', async () => {
  const app = listRuntime(); let complete;
  app.provider.remove = (id, version) => { app.calls.remove.push([id, version]); return new Promise((resolve) => { complete = resolve; }); };
  const pending = confirmAction(app.render(), app.record).props.onConfirm();
  assert.deepEqual(app.calls.remove, [[app.record.id, '7']]);
  assert.notEqual(status(app.render()), 'ลบรายงานแล้ว');
  complete(); await pending;
  assert.equal(status(app.render()), 'ลบรายงานแล้ว');
});
test('copy API rejection does not report success', async () => {
  const app = listRuntime(); app.provider.copy = async () => { throw new Error('conflict'); };
  const action = find(actions(app.render(), app.record), (n) => n.type === 'Button' && String(n.props['aria-label']).startsWith('คัดลอก '));
  await action.props.onClick();
  assert.equal(status(app.render()), 'conflict');
});
test('form waits for API resolution and blocks duplicate submission', async () => {
  let complete; let calls = 0; let saved = 0;
  const runtime = makeRuntime('mixing-form.tsx', {
    './mixing-provider': { useMixing: () => ({ save: () => { calls++; return new Promise((resolve) => { complete = resolve; }); } }) },
    './mixing-domain': { MixingValidationError },
  });
  const tree = runtime.render('MixingForm', { initial: fixture(), onSaved: () => saved++ });
  const pending = tree.props.onSubmit({ preventDefault() {} });
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(calls, 1); assert.equal(saved, 0);
  complete(); await pending;
  assert.equal(saved, 1);
});
test('material table shows unknown stock as a dash, real zero as zero', () => {
  const runtime = makeRuntime('mixing-material-table.tsx', {
    './mixing-provider': { useMixing: () => ({ catalog: [], loading: false, busy: false, error: '' }) },
    '@/src/lib/formatters': { quantity: (n) => String(n) },
  });
  const tree = runtime.render('MixingMaterialTable', { rows: [] });
  const stock = find(tree, (n) => n.type === 'FactoryDataTable').props.columns.find((c) => c.key === 'stock');
  assert.equal(stock.render({ stock_balance: null }), '—');
  assert.equal(stock.render({ stock_balance: 0 }), '0');
});
