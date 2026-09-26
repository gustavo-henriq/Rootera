/**
 * Growth diary: dated photos of a plant, kept on this device (never uploaded).
 * Native copies each photo into the app's documents folder, because picker results live
 * in a cache the system may clear; the web preview keeps the picker's data URL.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface DiaryEntry { id: string; uri: string; at: string }
const key = (plantId: string) => `rootera:diary:${plantId}`;

export async function loadDiary(plantId: string): Promise<DiaryEntry[]> {
  try { const raw = await AsyncStorage.getItem(key(plantId)); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

async function save(plantId: string, entries: DiaryEntry[]) {
  await AsyncStorage.setItem(key(plantId), JSON.stringify(entries));
  return entries;
}

export async function addToDiary(plantId: string, sourceUri: string): Promise<DiaryEntry[]> {
  const id = `${Date.now()}`;
  let uri = sourceUri;
  if (Platform.OS !== 'web') {
    const { Directory, File, Paths } = await import('expo-file-system');
    const dir = new Directory(Paths.document, 'diary');
    if (!dir.exists) dir.create();
    const target = new File(dir, `${plantId}-${id}.jpg`);
    await new File(sourceUri).copy(target);
    uri = target.uri;
  }
  const entries = await loadDiary(plantId);
  return save(plantId, [...entries, { id, uri, at: new Date().toISOString() }]);
}

export async function removeFromDiary(plantId: string, id: string): Promise<DiaryEntry[]> {
  const entries = await loadDiary(plantId);
  const gone = entries.find(e => e.id === id);
  if (gone && Platform.OS !== 'web') {
    try { const { File } = await import('expo-file-system'); const f = new File(gone.uri); if (f.exists) f.delete(); } catch { /* the entry goes either way */ }
  }
  return save(plantId, entries.filter(e => e.id !== id));
}
