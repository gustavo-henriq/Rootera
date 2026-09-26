// Pure model helpers, run with `npm run test:model`.
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/model.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
const i18nStub = { t: (s, v) => v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s, locale: () => 'en-US' };
vm.runInNewContext(source, { exports: mod.exports, module: mod, Date, Math, Intl, Proxy, require: id => { if (id === './i18n') return i18nStub; throw new Error(id); } });
const { ago, atCapacity, byUrgency, catalog, describeEvent, emptyGarden, known, matchesSpecies, searchText } = mod.exports;

const now = Date.parse('2026-09-25T12:00:00Z');
assert.equal(ago('2026-09-25T11:59:30Z', now), 'just now');
assert.equal(ago('2026-09-25T09:00:00Z', now), '3 h ago');
assert.equal(ago('2026-09-24T12:00:00Z', now), 'yesterday');
assert.equal(ago(null, now), '');

// A qualitative report is shown as reported, never as a percentage.
const soil = describeEvent({ type: 'Soil check', soil: 'dry' });
assert.equal(soil, 'Soil: dry');
assert.ok(!/%/.test(soil));
assert.equal(describeEvent({ type: 'Watered', amount_ml: 250 }), 'Watered, 250 ml');

assert.equal(known('Not sure'), false);
assert.equal(known("I don't know"), false);
assert.equal(known('Indoors'), true);

const plant = (id, name) => ({ id, name, kind: 'aloe', species: 'x', room: 'Not sure', pot: 'Not sure', light: 'Not sure' });
const twin = action => ({ guidance: { action } });
const garden = { ...emptyGarden, plants: [plant('a', 'Zamia'), plant('b', 'Aloe'), plant('c', 'Monstera')], twins: { a: twin('wait'), b: twin('check_soil'), c: twin('log_water') } };
assert.equal(byUrgency(garden).map(p => p.id).join(), 'c,b,a');
assert.equal(atCapacity(garden), true);
assert.equal(atCapacity({ ...garden, plan_capacity: null }), false);
// Forgiving search: accents, prefixes and one typo in longer words.
assert.equal(searchText('Manjericão!'), 'manjericao');
const find = q => catalog.filter(s => matchesSpecies(q, s)).map(s => s.kind).join();
assert.equal(find('orquídea'), 'orchid');
assert.equal(find('orquidia'), 'orchid');
assert.equal(find('samambia'), 'fern');
assert.equal(find('jiboa'), 'pothos');
assert.equal(find('espada de sao'), 'snake-plant');
assert.equal(find('xyzw'), '');
console.log('PASS model helpers: relative time, provenance-safe labels, urgency order, plan capacity, forgiving search');
