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
import { Welcome } from './src/screens/Welcome';
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

// Web preview only: `?gallery=1` opens the design-system reference.
const showGallery = Platform.OS === 'web' && typeof location !== 'undefined' && /[?&]gallery=1/.test(location.search);

const Stack = createNativeStackNavigator<Routes>();

function Navigator() {
  const { ready, garden } = useStore();
  const reduce = useReducedMotion();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: color.paper }}><ActivityIndicator color={color.olive} /></View>;
  const modal = { presentation: 'modal' as const, animation: reduce ? 'none' as const : 'slide_from_bottom' as const };
  return <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: color.paper, card: color.paper, text: color.ink, primary: color.olive, border: color.line } }}>
    <Stack.Navigator initialRouteName={garden.onboarded ? 'Main' : 'Welcome'} screenOptions={{ headerShown: false, animation: reduce ? 'none' : 'slide_from_right', contentStyle: { backgroundColor: color.paper } }}>
      <Stack.Screen name="Welcome" component={Welcome} options={{ animation: 'fade' }} />
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
            <StatusBar style={showGallery ? "auto" : "dark"} />
            {showGallery ? <Gallery /> : <StoreProvider><Navigator /></StoreProvider>}
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </View>
  </View>;
}
