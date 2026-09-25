export type PlantKind = 'aloe' | 'peace-lily' | 'monstera';
export type Plan = 'Free' | 'Seed' | 'Grow' | 'Thrive';
export type CareType = 'Watered' | 'Soil check' | 'Fertilized' | 'Observation';
export interface CareEvent { id: string; plantId: string; type: CareType; note: string; at: string; source: 'USER'; soil?: 'dry' | 'slightly_moist' | 'moist' | 'wet' | 'not_sure' | null; visual?: 'great' | 'different' | 'unwell' | 'not_sure' | null; amount_ml?: number | null; }
export interface Sensor { id: string; plantId: string; name: string; dry: number; wet: number; moisture: number | null; source: 'SENSOR'; observedAt: string | null; demo: boolean; calibrationVersion?: number | null; }
export interface Plant { id: string; name: string; species: string; kind: PlantKind; room: string; pot: string; light: string; photo?: string; time_with_owner?: string; stage?: string; environment?: {location:string;near_window:string}; drainage?: string; material?: string; self_watering?: string; substrate?: string; }
export interface Guidance { title:string; reason:string; action:string; learning:string; state:string; signals:string[]; baseline_days:number|null; completed_cycles:number; baseline_note:string; soil:string|null; visual:string|null; evidence_ids:string[] }
export interface Caregiver {experience:string;plant_count:string;detail:'Guided'|'Concise'}
export interface Twin { guidance?:Guidance; plant_id: string; measured: { soil_moisture_percent: number; stale: boolean; predates_watering: boolean; observed_at: string } | null; reported: { soil_condition: string; stale: boolean; observed_at: string } | null; inferred: { status: string; reason: string; confidence: number; evidence_ids: string[] }; conflicts: { reason: string }[]; evidence_count: number; demo_evidence_count: number; }
export interface AppData { version: 1; caregiver?:Caregiver; onboarded: boolean; name: string; plants: Plant[]; events: CareEvent[]; sensors: Sensor[]; plan: Plan; annual: boolean; reminders: boolean; twins?: Record<string, Twin>; }
export const catalog: Omit<Plant, 'id' | 'room' | 'pot' | 'light'>[] = [
  { name: 'Aloe Vera', species: 'Aloe barbadensis miller', kind: 'aloe' },
  { name: 'Peace Lily', species: 'Spathiphyllum wallisii', kind: 'peace-lily' },
  { name: 'Monstera', species: 'Monstera deliciosa', kind: 'monstera' },
];
export const initialData: AppData = { version: 1, onboarded: false, name: 'Gustavo', plants: [], events: [], sensors: [], plan: 'Free', annual: false, reminders: true };
export const limits: Record<Plan, number> = { Free: 3, Seed: 10, Grow: 30, Thrive: Infinity };
export const plans = [
  { name: 'Seed' as const, price: 9.9, kind: 'aloe' as const, features: ['10 plants', 'Quick check-ins', 'Care history'] },
  { name: 'Grow' as const, price: 19.9, kind: 'monstera' as const, features: ['30 plants', 'Environment context', 'Plant learning history'] },
  { name: 'Thrive' as const, price: 34.9, kind: 'peace-lily' as const, features: ['Unlimited plants', 'Quick check-ins', 'Care and learning history'] },
];
export function moisture(raw: number, dry: number, wet: number): number {
  if (![raw, dry, wet].every(v => Number.isInteger(v) && v >= 0 && v <= 4095) || dry <= wet) throw new Error('Dry reading must be greater than wet reading (0–4095).');
  return Math.max(0, Math.min(100, Math.round((dry - raw) / (dry - wet) * 100)));
}
export function addPlant(data: AppData, plant: Plant): AppData {
  if (data.plants.some(p => p.id === plant.id)) return data;
  if (data.plants.length >= limits[data.plan]) throw new Error('Plant limit reached');
  return { ...data, plants: [...data.plants, plant] };
}
export function plantStatus(data:AppData,id:string):string { return data.twins?.[id]?.guidance?.learning ?? 'Getting started'; }
export function guidanceFor(data:AppData,id:string):Guidance { return data.twins?.[id]?.guidance ?? {title:'Let’s get to know this plant',reason:'One quick soil check will give us a starting point.',action:'Check soil',learning:'Getting started',state:'NEW',signals:['Plant context'],baseline_days:null,completed_cycles:0,baseline_note:'Not enough observations yet.',soil:null,visual:null,evidence_ids:[]}; }
