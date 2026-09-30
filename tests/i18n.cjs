/**
 * Every English text the app can show must have a Portuguese entry in src/i18n-pt.ts,
 * with the same {placeholders}. Keys come from two places:
 *  - literals passed to t() and tn() anywhere in the app;
 *  - tables whose entries reach t() at render time (label tables, catalog names, the
 *    server's guidance titles and basis), listed below by file and declaration name.
 * `node tests/i18n.cjs --list` prints the missing keys, one per line.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel);
    else if (/\.tsx?$/.test(e.name) && !/i18n(-pt)?\.ts$|Gallery\.tsx$/.test(e.name)) files.push(rel);
  }
})('src');
files.push('App.tsx');

const STR = String.raw`'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"`;
const unescape = s => s.replace(/\\(['"\\])/g, '$1');
const keys = new Map(); // key -> first place it was seen
const add = (k, where) => { if (k && /[A-Za-z]/.test(k) && !keys.has(k)) keys.set(k, where); };

for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(new RegExp(String.raw`\bt\(\s*(?:${STR})`, 'g'))) add(unescape(m[1] ?? m[2]), f);
  for (const m of src.matchAll(new RegExp(String.raw`\btn\([^,]+,\s*(?:${STR})\s*,\s*(?:${STR})`, 'g'))) {
    add(unescape(m[1] ?? m[2]), f); add(unescape(m[3] ?? m[4]), f);
  }
}

// Tables translated where they are shown: every quoted text inside the declaration.
const TABLES = {
  'src/model.ts': ['catalog', 'soilLabel', 'layerLabel', 'visualLabel', 'experienceLabel', 'experienceHint', 'CareType'],
  'src/ds/components.tsx': ['sourceText'],
  'src/ds/WhySheet.tsx': ['GROUPS'],
  'src/ds/DepthRuler.tsx': ['DEPTH'],
  'src/ds/SoilLayers.tsx': ['INFO', 'HINT'],
  'src/screens/Lab.tsx': ['METHODS', 'STEPS', 'LAYER_NAME', 'LAYER_VALUE', 'LEAVES', 'POTS', 'LIGHTS', 'PACES', 'SCENES', 'CLIMATES'],
  'src/screens/LabStory.tsx': ['CAPTIONS'],
  'src/ds/DryWindow.tsx': ['factorLabel'],
  'src/screens/Farewell.tsx': ['CHOICES', 'WORDS'],
  'src/screens/Care.tsx': ['visualHints', 'AMOUNTS', 'STAGES', 'stageHints'],
  'src/screens/Plant.tsx': ['statusSpeech'],
  'src/screens/Main.tsx': ['tabs', 'CHECK_IN', 'nudgeNames'],
  'src/screens/Plans.tsx': ['heads', 'benefits', 'periodLabel'],
  'src/screens/Profile.tsx': ['layers', 'text'],
  'src/screens/PlantForm.tsx': ['LOCATIONS', 'LIGHT', 'YES_NO', 'POT', 'MATERIAL', 'SUBSTRATE', 'lightLabels'],
  'src/screens/onboarding/FirstPlant.tsx': ['LIGHT', 'POTS', 'STAGES', 'WATERED', 'SOILS', 'QUESTION', 'LABEL'],
  'src/screens/onboarding/Nudges.tsx': ['nudgeCopy'],
  'src/screens/onboarding/Story.tsx': ['SOURCES'],
  'src/screens/onboarding/Opening.tsx': ['LINE', 'SUB'],
};
// Not prose: identifiers, kinds, latin names and aliases that happen to sit in these tables.
const VALUES = new Set(['nudgeNames', 'factorLabel']);
const SKIP = /^([a-z0-9_-]+|[A-Z][a-z]+ [a-z]+( [a-z]+)?|\d+)$/;
for (const [f, names] of Object.entries(TABLES)) {
  const src = read(f);
  for (const name of names) {
    const start = src.search(new RegExp(String.raw`(const|type)\s+${name}\b`));
    if (start < 0) throw new Error(`${f}: no declaration named ${name}`);
    const end = src.indexOf(';\n', start);
    const body = src.slice(start, end);
    for (const m of body.matchAll(new RegExp(STR, 'g'))) {
      const v = unescape(m[1] ?? m[2]);
      // Catalog rows: only the common name ("name: '...'") is shown.
      if (name === 'catalog' && !/name:\s*$/.test(body.slice(0, m.index))) continue;
      // Lookup tables (key: 'text'): every value is shown, even a single lowercase word.
      const isValue = /:\s*$/.test(body.slice(0, m.index));
      if (name !== 'catalog' && SKIP.test(v) && !/^[A-Z]/.test(v) && !(VALUES.has(name) && isValue)) continue;
      add(v, `${f}#${name}`);
    }
  }
}
// Stage phrases and the server's words that the app translates (titles in change reports, basis).
for (const s of ['Seedling', 'Young', 'Mature']) add(`${s} plant`, 'src/screens/Plant.tsx#where');
for (const s of ['Bright, indirect', 'Low', 'Indirect']) add(s, 'src/screens/Plant.tsx#light');
const guidance = fs.readFileSync(path.join(root, 'backend/app/guidance.py'), 'utf8');
for (const m of guidance.matchAll(/title, action = _\('([^']+)'/g)) add(m[1], 'guidance.py#title');
for (const m of guidance.matchAll(/'(Still moist|The soil is wet)'/g)) add(m[1], 'guidance.py#title');
for (const m of guidance.matchAll(/basis = \[([^\]]*)\]/g)) for (const b of m[1].matchAll(/'([^']+)'/g)) add(b[1], 'guidance.py#basis');
for (const m of guidance.matchAll(/\['(Pot details you added)'\]/g)) add(m[1], 'guidance.py#basis');

// The Portuguese dictionary, read as data (a TS file with one object literal).
const ptSrc = read('src/i18n-pt.ts');
const body = ptSrc.slice(ptSrc.indexOf('{', ptSrc.indexOf('PT')) , ptSrc.lastIndexOf('}') + 1);
const PT = Function(`return (${body});`)();

const holes = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const missing = [...keys.keys()].filter(k => !(k in PT));
const broken = [...keys.keys()].filter(k => k in PT && holes(k) !== holes(PT[k]));
const unused = Object.keys(PT).filter(k => !keys.has(k));

if (process.argv.includes('--list')) { missing.forEach(k => console.log(k)); process.exit(0); }
if (process.argv.includes('--unused')) { unused.forEach(k => console.log(JSON.stringify(k))); process.exit(0); }
let fail = false;
if (missing.length) { fail = true; console.error(`Missing Portuguese for ${missing.length} text(s):`); missing.forEach(k => console.error(`  ${JSON.stringify(k)}  (${keys.get(k)})`)); }
if (broken.length) { fail = true; console.error('Placeholders differ:'); broken.forEach(k => console.error(`  ${JSON.stringify(k)} -> ${JSON.stringify(PT[k])}`)); }
if (unused.length) console.warn(`Note: ${unused.length} Portuguese entr${unused.length === 1 ? 'y is' : 'ies are'} no longer used: ${unused.slice(0, 5).map(k => JSON.stringify(k)).join(', ')}${unused.length > 5 ? '…' : ''}`);
if (fail) process.exit(1);
console.log(`PASS i18n: ${keys.size} texts, all with Portuguese and matching placeholders`);
