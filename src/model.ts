export type PlantKind = 'aloe' | 'peace-lily' | 'monstera' | 'pothos' | 'snake-plant' | 'zz' | 'pilea' | 'cactus' | 'other';
export type Plan = 'Free' | 'Plus';
export type Experience = 'first' | 'some' | 'many';
export type CareType = 'Watered' | 'Soil check' | 'Fertilized' | 'Observation';
export type Soil = 'dry' | 'slightly_moist' | 'moist' | 'wet' | 'not_sure';
export type Visual = 'great' | 'different' | 'unwell' | 'not_sure';
export type Action = 'check_soil' | 'log_water' | 'observe' | 'wait';

export interface CareEvent { id: string; plantId: string; type: CareType; note: string; at: string; source: 'USER'; soil?: Soil | null; visual?: Visual | null; amount_ml?: number | null }

export interface PlantContext {
  room: string; pot: string; light: string; time_with_owner?: string; stage?: string;
  environment?: { location: string; near_window: string }; drainage?: string; material?: string; self_watering?: string; substrate?: string;
}
export interface Plant extends PlantContext { id: string; name: string; species: string; kind: PlantKind; photo?: string | null }

export interface Guidance {
  title: string; reason: string; action: Action; tip: string | null; basis: string[];
  state: 'NEW' | 'LEARNING' | 'PATTERN'; learning: string;
  baseline_days: number | null; completed_cycles: number; baseline_note: string;
  soil: Soil | null; soil_checked_at: string | null; visual: Visual | null;
  last_watered_at: string | null; last_soil_check_at: string | null;
  reference: { summary: string; when_dry: string; check_tip: string };
}
export interface Twin {
  guidance: Guidance;
  measured: { soil_moisture_percent: number; stale: boolean; observed_at: string } | null;
  sources: { user: { observations: number }; sensor: { connected: boolean; readings: number }; external: { weather: boolean; identification: boolean }; reference: { species_notes: boolean } };
}
export interface Caregiver { experience: Experience; detail: 'Guided' | 'Concise' }
export interface Integrations { billing: boolean; identification: boolean; weather: boolean; demo: boolean }
export interface Garden {
  user_id: string; name: string; onboarded: boolean; reminders: boolean; caregiver?: Caregiver;
  plan: Plan; annual: boolean; plan_source?: string; plan_capacity: number | null;
  plants: Plant[]; events: CareEvent[]; twins: Record<string, Twin>; integrations: Integrations;
}

export const emptyGarden: Garden = {
  user_id: '', name: '', onboarded: false, reminders: true, plan: 'Free', annual: false, plan_capacity: 3,
  plants: [], events: [], twins: {}, integrations: { billing: false, identification: false, weather: false, demo: true },
};

export interface Species { kind: PlantKind; name: string; latin: string; aliases: string }
export const catalog: Species[] = [
  { kind: 'monstera', name: 'Monstera', latin: 'Monstera deliciosa', aliases: 'swiss cheese plant costela de adao' },
  { kind: 'pothos', name: 'Pothos', latin: 'Epipremnum aureum', aliases: 'devils ivy jiboia' },
  { kind: 'peace-lily', name: 'Peace Lily', latin: 'Spathiphyllum wallisii', aliases: 'lirio da paz spathiphyllum' },
  { kind: 'snake-plant', name: 'Snake Plant', latin: 'Dracaena trifasciata', aliases: 'sansevieria mother in law espada de sao jorge' },
  { kind: 'zz', name: 'ZZ Plant', latin: 'Zamioculcas zamiifolia', aliases: 'zamioculca zanzibar gem' },
  { kind: 'pilea', name: 'Chinese Money Plant', latin: 'Pilea peperomioides', aliases: 'pilea pancake plant' },
  { kind: 'aloe', name: 'Aloe Vera', latin: 'Aloe barbadensis miller', aliases: 'babosa aloe' },
  { kind: 'cactus', name: 'Cactus', latin: 'Cactaceae', aliases: 'cacto succulent' },
];

export const soilLabel: Record<Soil, string> = { dry: 'Dry', slightly_moist: 'Slightly moist', moist: 'Moist', wet: 'Very wet', not_sure: 'Not sure' };
export const visualLabel: Record<Visual, string> = { great: 'Looks good', different: 'Something changed', unwell: 'Not doing well', not_sure: 'Not sure' };
export const experienceLabel: Record<Experience, string> = { first: 'First plant', some: 'A few plants', many: 'Many plants or a garden' };

/** The interface is in English, so dates follow it rather than the device language. */
export const LOCALE = 'en-US';

export const known = (value?: string | null) => !!value && !['Not sure', "I don't know", ''].includes(value);

export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
}

export function describeEvent(e: CareEvent): string {
  if (e.type === 'Soil check') return `Soil · ${e.soil ? soilLabel[e.soil] : '—'}`;
  if (e.type === 'Observation') return `Leaves · ${e.visual ? visualLabel[e.visual] : 'Note'}`;
  if (e.type === 'Watered') return e.amount_ml ? `Watered · ${e.amount_ml} ml` : 'Watered';
  return e.type;
}

/** Plants that need the caregiver first: a check or a watering decision beats waiting. */
export function byUrgency(garden: Garden): Plant[] {
  const rank: Record<Action, number> = { log_water: 0, check_soil: 1, observe: 2, wait: 3 };
  return [...garden.plants].sort((a, b) => (rank[garden.twins[a.id]?.guidance.action ?? 'check_soil'] - rank[garden.twins[b.id]?.guidance.action ?? 'check_soil']) || a.name.localeCompare(b.name));
}

export function atCapacity(garden: Garden) {
  return garden.plan_capacity !== null && garden.plants.length >= garden.plan_capacity;
}
