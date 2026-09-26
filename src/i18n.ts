/**
 * Translations. English source text is the key: `t('Check in')`, and placeholders use
 * braces: `t('{n} plants', { n })`. Portuguese (Brazil) lives in ./i18n-pt.ts; a missing
 * key falls back to English, and `npm run test:i18n` fails if any key is missing.
 * The language follows the phone unless the person picks one in You > Language.
 * Changing it remounts the app (see App.tsx), so every screen re-reads its text.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PT } from './i18n-pt';

export type Lang = 'en' | 'pt';
export type LangChoice = 'system' | Lang;
const KEY = 'rootera:lang';

function systemLang(): Lang {
  try { return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('pt') ? 'pt' : 'en'; } catch { return 'en'; }
}

let current: Lang = systemLang();
let choice: LangChoice = 'system';
const listeners = new Set<() => void>();

export const lang = () => current;
export const langChoice = () => choice;
/** BCP 47 tag for dates and numbers. */
export const locale = () => (current === 'pt' ? 'pt-BR' : 'en-US');

type Vars = Record<string, string | number | null | undefined>;

const warned = new Set<string>();

export function t(text: string, vars?: Vars): string {
  if (current === 'pt' && !(text in PT) && typeof __DEV__ !== 'undefined' && __DEV__ && !warned.has(text)) {
    warned.add(text);
    console.warn(`[i18n] No Portuguese for: ${text}`);
  }
  const s = current === 'pt' ? PT[text] ?? text : text;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m)) : s;
}

/** Singular or plural by count: `tn(n, '{n} plant', '{n} plants')`. */
export function tn(n: number, one: string, many: string, vars?: Vars) {
  return t(n === 1 ? one : many, { n, ...vars });
}

export async function loadLang() {
  try {
    const saved = (await AsyncStorage.getItem(KEY)) as LangChoice | null;
    if (saved === 'en' || saved === 'pt' || saved === 'system') choice = saved;
  } catch { /* the phone's language */ }
  current = choice === 'system' ? systemLang() : choice;
}

export async function setLang(next: LangChoice) {
  choice = next;
  current = next === 'system' ? systemLang() : next;
  try { await AsyncStorage.setItem(KEY, next); } catch { /* still applies for this session */ }
  listeners.forEach(f => f());
}

export function onLangChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
