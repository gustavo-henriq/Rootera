import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PlantKind, Plan } from './model';
export type Routes = {
 Welcome: undefined; Email: undefined; Onboarding: { replay?: boolean } | undefined; Main: { tab?: 'Home' | 'Plants' | 'Activity' | 'Profile' } | undefined;
 AddPlant: undefined; Camera: undefined; Search: undefined; Result: { kind: PlantKind; photo?: string };
 Register: { kind: PlantKind; photo?: string }; Details: { id: string; feedback?: string }; LogCare: { id: string; mode?: 'soil'|'visual'|'water' };
 Plans: undefined; Checkout: { plan: Exclude<Plan, 'Free'>; annual: boolean }; Success: { plan: Plan; returnTo: 'AddPlant' | 'Main' };
 Sensors: undefined; Pairing: { plantId?: string } | undefined; Calibration: { plantId: string; name: string };
 Notifications: undefined; Settings: undefined; Article: { title: string; content: string };
};
export type Props<T extends keyof Routes> = NativeStackScreenProps<Routes, T>;
