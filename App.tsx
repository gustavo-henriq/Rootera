import React from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Figtree_400Regular, Figtree_400Regular_Italic, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold, useFonts,
} from '@expo-google-fonts/figtree';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { StoreProvider, useStore } from './src/store';
import { Routes } from './src/navigation';
import { color } from './src/theme';
import { useReducedMotion } from './src/ui';
import { Onboarding } from './src/screens/Onboarding';
import { LogoSprout } from './src/ds/LogoSprout';
import { useTheme } from './src/ds/theme';
import { Main } from './src/screens/Main';
import { AddPlant } from './src/screens/AddPlant';
import { Camera } from './src/screens/Camera';
import { PlantForm } from './src/screens/PlantForm';
import { Plant } from './src/screens/Plant';
import { Care } from './src/screens/Care';
import { Plans } from './src/screens/Plans';
import { About, Experience } from './src/screens/Profile';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './src/ds/theme';
import { Gallery } from './src/ds/Gallery';
import { Proto, protoParam } from './src/ds/Protos';

// Web preview only: `?gallery=1` opens the design-system reference.
const showGallery = Platform.OS === 'web' && typeof location !== 'undefined' && /[?&]gallery=1/.test(location.search);

const Stack = createNativeStackNavigator<Routes>();

/** Later launches: the short sprout, under a second, then straight into the garden. */
function Launch({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  return <View style={{ flex: 1, backgroundColor: c.canvas, alignItems: 'center', justifyContent: 'center' }}>
    <LogoSprout width={200} run={1} variant="short" onDone={() => setTimeout(onDone, 150)} />
  </View>;
}

function Navigator() {
  const { ready, garden } = useStore();
  const { c } = useTheme();
  const reduce = useReducedMotion();
  // Decided once, when the garden first loads: the short sprout plays only if the app
  // opened on an existing garden, never in the middle of onboarding.
  const [launch, setLaunch] = React.useState<'pending' | 'play' | 'done'>('pending');
  React.useEffect(() => { if (ready && launch === 'pending') setLaunch(garden.onboarded ? 'play' : 'done'); }, [ready]);
  if (!ready || launch === 'pending') return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: c.canvas }}><ActivityIndicator color={c.ink2} /></View>;
  if (launch === 'play') return <Launch onDone={() => setLaunch('done')} />;
  const modal = { presentation: 'modal' as const, animation: reduce ? 'none' as const : 'slide_from_bottom' as const };
  return <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: color.paper, card: color.paper, text: color.ink, primary: color.olive, border: color.line } }}>
    <Stack.Navigator initialRouteName={garden.onboarded ? 'Main' : 'Welcome'} screenOptions={{ headerShown: false, animation: reduce ? 'none' : 'slide_from_right', contentStyle: { backgroundColor: color.paper } }}>
      <Stack.Screen name="Welcome" component={Onboarding} options={{ animation: 'fade' }} />
      <Stack.Screen name="Main" component={Main} options={{ animation: 'fade' }} />
      <Stack.Screen name="AddPlant" component={AddPlant} />
      <Stack.Screen name="Camera" component={Camera} options={modal} />
      <Stack.Screen name="PlantForm" component={PlantForm} />
      <Stack.Screen name="Plant" component={Plant} />
      <Stack.Screen name="Care" component={Care} options={modal} />
      <Stack.Screen name="Plans" component={Plans} options={modal} />
      <Stack.Screen name="Experience" component={Experience} />
      <Stack.Screen name="About" component={About} />
    </Stack.Navigator>
  </NavigationContainer>;
}

export default function App() {
  const [loaded, error] = useFonts({ InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic, Figtree_400Regular, Figtree_400Regular_Italic, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold });
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: color.paper }} />;
  if (error) return <Text style={{ padding: 40 }}>Rootera couldn’t load its fonts. Please restart the app.</Text>;
  // On the web preview, keep a phone-width column so layouts match the device.
  return <View style={{ flex: 1, backgroundColor: color.paperDeep, alignItems: 'center' }}>
    <View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 430 : undefined, backgroundColor: color.paper }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            {/* Screens adopt dark mode as they migrate to src/ds (phase 4); until then the bar stays dark. */}
            <StatusBar style={showGallery || protoParam ? "auto" : "dark"} />
            {protoParam ? <Proto which={protoParam} /> : showGallery ? <Gallery /> : <StoreProvider><Navigator /></StoreProvider>}
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </View>
  </View>;
}
