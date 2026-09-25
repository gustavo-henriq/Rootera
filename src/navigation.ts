import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PlantKind } from './model';

export type Tabs = { Today: undefined; Plants: undefined; Journal: undefined; You: undefined };

export type Routes = {
  Welcome: undefined;
  Main: { tab?: keyof Tabs } | undefined;
  AddPlant: { first?: boolean; photo?: string } | undefined;
  Camera: { first?: boolean } | undefined;
  PlantForm: { kind: PlantKind; species: string; name: string; photo?: string; first?: boolean } | { editId: string };
  Plant: { id: string; saved?: { title: string; from?: string; to?: string } };
  Care: { id: string; mode: 'soil' | 'water' | 'visual' };
  Plans: { reason?: 'limit' | 'rooms' | 'first'; then?: { plantId: string } } | undefined;
  Experience: undefined;
  Nudges: undefined;
  About: undefined;
};

export type Props<T extends keyof Routes> = NativeStackScreenProps<Routes, T>;
