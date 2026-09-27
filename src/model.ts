import { locale, t } from './i18n';
export type PlantKind = 'aloe' | 'peace-lily' | 'monstera' | 'pothos' | 'snake-plant' | 'zz' | 'pilea' | 'cactus'
  | 'gerbera' | 'sunflower' | 'orchid' | 'fern' | 'echeveria' | 'rubber-plant' | 'calathea' | 'basil' | 'other';
export type Plan = 'Free' | 'Plus';
export type Experience = 'first' | 'some' | 'many';
export type CareType = 'Watered' | 'Soil check' | 'Fertilized' | 'Observation';
export type Soil = 'dry' | 'slightly_moist' | 'moist' | 'wet' | 'not_sure';
export type Visual = 'great' | 'different' | 'unwell' | 'not_sure';
export type Action = 'check_soil' | 'log_water' | 'observe' | 'wait';

export interface CareEvent { id: string; plantId: string; type: CareType; note: string; at: string; source: 'USER'; soil?: Soil | null; visual?: Visual | null; amount_ml?: number | null;
  /** A watering remembered roughly (at setup): not used as the start of a drying cycle. */
  approximate?: boolean;
}

export interface PlantContext {
  room: string; pot: string; light: string; time_with_owner?: string; stage?: string;
  environment?: { location: string; near_window: string }; drainage?: string; material?: string; self_watering?: string; substrate?: string;
}
export interface Plant extends PlantContext {
  id: string; name: string; species: string; kind: PlantKind; photo?: string | null;
  /** The example plant every account starts with (backend/app/example.py): labelled, outside the plan limit. */
  example?: boolean;
}

/** Drying window from the server (backend/app/forecast.py). */
export interface Forecast {
  source: 'cycles' | 'blend' | 'estimate'; low_days: number; high_days: number; cycles: number; factors: string[];
  /** Days after watering when the app starts asking for a check (earlier than low_days while estimated). */
  check_after_days?: number;
  check_from: string | null; dry_by: string | null;
}
export interface Guidance {
  title: string; reason: string; action: Action; tip: string | null; basis: string[];
  state: 'NEW' | 'LEARNING' | 'PATTERN'; learning: string;
  baseline_days: number | null; completed_cycles: number; baseline_note: string; forecast?: Forecast | null;
  /** Cycles behind the pattern: the most recent ones (up to 6). */
  pattern_cycles?: number;
  soil: Soil | null; soil_checked_at: string | null; visual: Visual | null;
  last_watered_at: string | null; last_soil_check_at: string | null;
  reference: { summary: string; when_dry: string; check_tip: string; dryness?: 'top' | 'half' | 'full' | 'unknown' };
}
export interface Twin {
  guidance: Guidance;
  measured: { soil_moisture_percent: number; stale: boolean; observed_at: string } | null;
  sources: { user: { observations: number }; sensor: { connected: boolean; readings: number }; external: { weather: boolean; identification: boolean }; reference: { species_notes: boolean } };
}
export interface Caregiver { experience: Experience; detail: 'Guided' | 'Concise' }
export type NudgeKind = 'soil_check' | 'pattern' | 'leaves' | 'weekly';
export interface Nudges { kinds: NudgeKind[]; time: string }
export interface Integrations { billing: boolean; identification: boolean; weather: boolean; demo: boolean }
export interface Garden {
  user_id: string; name: string; onboarded: boolean; reminders: boolean; caregiver?: Caregiver; nudges?: Nudges;
  plan: Plan; annual: boolean; plan_source?: string; plan_capacity: number | null;
  /** Plants that count toward the plan (the example plant does not). */
  plan_used?: number;
  plants: Plant[]; events: CareEvent[]; twins: Record<string, Twin>; integrations: Integrations;
  /** False when the snapshot carries only the most recent records; older ones come from /v1/journal. */
  events_complete?: boolean;
}

export const emptyGarden: Garden = {
  user_id: '', name: '', onboarded: false, reminders: true, plan: 'Free', annual: false, plan_capacity: 3,
  plants: [], events: [], twins: {}, integrations: { billing: false, identification: false, weather: false, demo: true },
};

/** `featured` species have their own illustration and appear in the first-plant carousel; the rest are found by search. */
export interface Species { kind: PlantKind; name: string; latin: string; aliases: string; featured?: boolean }
export const catalog: Species[] = [
  { kind: 'monstera', featured: true, name: 'Monstera', latin: 'Monstera deliciosa', aliases: 'swiss cheese plant costela de adao' },
  { kind: 'pothos', featured: true, name: 'Pothos', latin: 'Epipremnum aureum', aliases: 'devils ivy jiboia' },
  { kind: 'peace-lily', featured: true, name: 'Peace Lily', latin: 'Spathiphyllum wallisii', aliases: 'lirio da paz spathiphyllum' },
  { kind: 'snake-plant', featured: true, name: 'Snake Plant', latin: 'Dracaena trifasciata', aliases: 'sansevieria mother in law espada de sao jorge' },
  { kind: 'zz', featured: true, name: 'ZZ Plant', latin: 'Zamioculcas zamiifolia', aliases: 'zamioculca zanzibar gem' },
  { kind: 'pilea', featured: true, name: 'Chinese Money Plant', latin: 'Pilea peperomioides', aliases: 'pilea pancake plant planta do dinheiro chinesa' },
  { kind: 'aloe', featured: true, name: 'Aloe Vera', latin: 'Aloe barbadensis miller', aliases: 'babosa aloe' },
  { kind: 'cactus', featured: true, name: 'Cactus', latin: 'Cactaceae', aliases: 'cacto succulent' },
  { kind: 'gerbera', featured: true, name: 'Gerbera', latin: 'Gerbera jamesonii', aliases: 'gerbera daisy margarida africana flower flor' },
  { kind: 'sunflower', name: 'Sunflower', latin: 'Helianthus annuus', aliases: 'girassol flower flor' },
  { kind: 'orchid', name: 'Moth Orchid', latin: 'Phalaenopsis', aliases: 'orquidea orchid phalaenopsis flower flor' },
  { kind: 'fern', name: 'Boston Fern', latin: 'Nephrolepis exaltata', aliases: 'samambaia fern' },
  { kind: 'echeveria', name: 'Echeveria', latin: 'Echeveria', aliases: 'suculenta succulent rosa de pedra' },
  { kind: 'rubber-plant', name: 'Rubber Plant', latin: 'Ficus elastica', aliases: 'falsa seringueira ficus rubber tree' },
  { kind: 'calathea', name: 'Calathea', latin: 'Goeppertia', aliases: 'maranta calathea prayer plant' },
  { kind: 'basil', name: 'Basil', latin: 'Ocimum basilicum', aliases: 'manjericao herb erva' },
];

/** Label tables read through t(), so every `soilLabel[x]` is already in the current language. */
function translated<K extends string>(table: Record<K, string>): Record<K, string> {
  return new Proxy(table, { get: (o, k) => (typeof k === 'string' && k in o ? t((o as Record<string, string>)[k]) : (o as any)[k]) });
}
export const soilLabel = translated<Soil>({ dry: 'Dry', slightly_moist: 'Slightly moist', moist: 'Moist', wet: 'Very wet', not_sure: 'Not sure' });
export const visualLabel = translated<Visual>({ great: 'Looks good', different: 'Something changed', unwell: 'Not doing well', not_sure: 'Not sure' });
export const experienceLabel = translated<Experience>({ first: 'My first plant', some: 'A few plants', many: 'Lots of plants, or a whole garden' });
export const experienceHint = translated<Experience>({ first: 'Explains how to check and what to look for.', some: 'Short tips for each plant.', many: 'Straight to the point.' });
/** A species' common name in the current language (catalog names are English keys). */
export const speciesName = (s: Pick<Species, 'name'>) => t(s.name);

export const known = (value?: string | null) => !!value && !['Not sure', "I don't know", ''].includes(value);

export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return t('just now');
  if (minutes < 60) return t('{n} min ago', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('{n} h ago', { n: hours });
  const days = Math.round(hours / 24);
  if (days === 1) return t('yesterday');
  if (days < 30) return t('{n} days ago', { n: days });
  return new Date(iso).toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
}

export function describeEvent(e: CareEvent): string {
  if (e.type === 'Soil check') return e.soil ? t('Soil: {v}', { v: soilLabel[e.soil].toLowerCase() }) : t('Soil check');
  if (e.type === 'Observation') return e.visual ? t('Leaves: {v}', { v: visualLabel[e.visual].toLowerCase() }) : t('Leaf note');
  if (e.type === 'Watered') return e.amount_ml ? t('Watered, {n} ml', { n: e.amount_ml }) : t('Watered');
  return t(e.type);
}

/** Plants that need the caregiver first: a check or a watering decision beats waiting. */
export function byUrgency(garden: Garden): Plant[] {
  const rank: Record<Action, number> = { log_water: 0, check_soil: 1, observe: 2, wait: 3 };
  return [...garden.plants].sort((a, b) => (rank[garden.twins[a.id]?.guidance.action ?? 'check_soil'] - rank[garden.twins[b.id]?.guidance.action ?? 'check_soil']) || a.name.localeCompare(b.name));
}

export const planUsed = (garden: Garden) => garden.plan_used ?? garden.plants.filter(p => !p.example).length;

export function atCapacity(garden: Garden) {
  return garden.plan_capacity !== null && planUsed(garden) >= garden.plan_capacity;
}

/** Text for matching searches: lower case, no accents or punctuation ("Manjericão!" matches "manjericao"). */
export const searchText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function withinOneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Forgiving species search: accents and punctuation ignored, words match by prefix, and
 * a word of 4+ letters may have one typo ("orquidia", "samambia", "jiboa" still match).
 */
export function matchesSpecies(query: string, s: Species) {
  const words = searchText(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = searchText(`${s.name} ${s.latin} ${s.aliases}`).split(' ');
  return words.every(w => hay.some(h => h.startsWith(w) || (w.length >= 4 && (withinOneEdit(w, h) || withinOneEdit(w, h.slice(0, w.length))))));
}
