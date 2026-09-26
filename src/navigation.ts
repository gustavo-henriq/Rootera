import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PlantKind } from './model';

export type Tabs = { Today: undefined; Plants: undefined; Journal: undefined; You: undefined };

export type Routes = {
  Welcome: { preview?: boolean; photo?: string } | undefined;
  Main: { tab?: keyof Tabs } | undefined;
  AddPlant: { first?: boolean; photo?: string } | undefined;
  Camera: { first?: boolean; returnTo?: 'Welcome' } | undefined;
  PlantForm: { kind: PlantKind; species: string; name: string; photo?: string; first?: boolean } | { editId: string };
  Plant: { id: string; from?: { x: number; y: number; w: number; h: number }; saved?: { title: string; from?: string; to?: string; undo?: { ids: string[]; stage?: string } } };
  Care: { id: string; mode: 'checkin' | 'soil' | 'water' | 'visual' };
  Plans: { reason?: 'limit' | 'rooms' | 'first'; then?: { plantId: string } } | undefined;
  Experience: undefined;
  Nudges: undefined;
  About: undefined;
};

export type Props<T extends keyof Routes> = NativeStackScreenProps<Routes, T>;
