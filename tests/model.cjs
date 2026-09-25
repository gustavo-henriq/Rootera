// Pure model helpers, run with `npm run test:model`.
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/model.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
vm.runInNewContext(source, { exports: mod.exports, module: mod, Date, Math });
const { ago, atCapacity, byUrgency, describeEvent, emptyGarden, known } = mod.exports;

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
console.log('PASS model helpers: relative time, provenance-safe labels, urgency order, plan capacity');
