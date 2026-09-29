import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PlantKind } from './model';

/** Journal can open on one plant: its history (calendar and records) or its photos first. */
export type JournalParams = { plant?: string; show?: 'history' | 'photos' } | undefined;
export type Tabs = { Today: undefined; Plants: undefined; Journal: JournalParams; You: undefined };

export type Routes = {
  Welcome: { preview?: boolean; photo?: string } | undefined;
  Main: { tab?: keyof Tabs } | undefined;
  /** `attempt`: which photo this is (up to three before the name is asked for). */
  AddPlant: { first?: boolean; photo?: string; attempt?: number } | undefined;
  Camera: { first?: boolean; returnTo?: 'Welcome'; attempt?: number } | undefined;
  PlantForm: { kind: PlantKind; species: string; name: string; photo?: string; first?: boolean } | { editId: string; /** Open on the pot and soil details. */ pot?: boolean };
  Plant: { id: string; from?: { x: number; y: number; w: number; h: number }; saved?: { title: string; from?: string; to?: string; undo?: { ids: string[]; stage?: string }; milestone?: string } };
  Care: { id: string; mode: 'checkin' | 'soil' | 'water' | 'visual' };
  Plans: { reason?: 'limit' | 'rooms' | 'first' | 'diary'; then?: { plantId: string } } | undefined;
  Experience: undefined;
  Nudges: undefined;
  About: undefined;
  /** Check-in round over every plant that needs you. */
  Round: undefined;
  /** The Shipaton lab: a simulated plant run through the real engine. */
  Lab: undefined;
};

export type Props<T extends keyof Routes> = NativeStackScreenProps<Routes, T>;
