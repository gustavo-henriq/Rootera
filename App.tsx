import React from 'react';
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque';
import { InstrumentSans_400Regular, InstrumentSans_400Regular_Italic, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { StoreProvider, useStore } from './src/store';
import { Routes } from './src/navigation';
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
import { About, Experience, Nudges } from './src/screens/Profile';
import { Round } from './src/screens/Round';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './src/ds/theme';
import { Gallery } from './src/ds/Gallery';
import { preloadImages } from './src/ds/preload';
import { TodaySkeleton, Unreachable } from './src/ds/states';
import { scheduleNudges } from './src/nudges';
import { ProfileInvite } from './src/screens/ProfileInvite';
import * as SplashScreen from 'expo-splash-screen';
import { lang, loadLang, onLangChange, t } from './src/i18n';

// Keep the native splash up until fonts and artwork are ready.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

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
  const { ready, garden, source, refresh } = useStore();
  const { c, scheme, reduceMotion: reduce } = useTheme();
  // Phone nudges follow the garden: rescheduled when records, plants or settings change.
  const twinKey = Object.values(garden.twins).map(x => x.guidance.action).join('');
  // A new language remounts the screens (so every text is read again), refetches the
  // server's guidance in that language and reopens on You, where the choice was made.
  const [langKey, setLangKey] = React.useState(lang());
  React.useEffect(() => onLangChange(() => { setLangKey(lang()); void refresh(); }), [refresh]);
  React.useEffect(() => { if (source === 'server' && garden.onboarded) void scheduleNudges(garden); },
    [source, garden.onboarded, garden.reminders, garden.nudges?.time, garden.nudges?.kinds.join(), garden.plants.length, twinKey, garden.caregiver?.detail, langKey]);
  const firstLang = React.useRef(langKey).current;
  // Decided once, when the garden first loads: the short sprout plays only if the app
  // opened on an existing garden, never in the middle of onboarding.
  const [launch, setLaunch] = React.useState<'pending' | 'play' | 'done'>('pending');
  // Never decide "new user" without knowing: with no cache and no server there is no garden to judge.
  React.useEffect(() => { if (ready && source !== 'none' && launch === 'pending') setLaunch(garden.onboarded ? 'play' : 'done'); }, [ready, source]);
  if (!ready) return <TodaySkeleton />;
  if (source === 'none') return <Unreachable onRetry={refresh} />;
  if (launch === 'pending') return <TodaySkeleton />;
  if (launch === 'play') return <Launch onDone={() => setLaunch('done')} />;
  const modal = { presentation: 'modal' as const, animation: reduce ? 'none' as const : 'slide_from_bottom' as const };
  return <NavigationContainer key={langKey} theme={{ ...(scheme === 'dark' ? DarkTheme : DefaultTheme), colors: { ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors, background: c.canvas, card: c.canvas, text: c.ink, primary: c.action, border: c.hairline } }}>
    <Stack.Navigator initialRouteName={garden.onboarded ? 'Main' : 'Welcome'} screenOptions={{ headerShown: false, animation: reduce ? 'none' : 'slide_from_right', contentStyle: { backgroundColor: c.canvas } }}>
      <Stack.Screen name="Welcome" component={Onboarding} options={{ animation: 'fade' }} />
      <Stack.Screen name="Main" component={Main} options={{ animation: 'fade' }} initialParams={langKey !== firstLang ? { tab: 'You' } : undefined} />
      <Stack.Screen name="AddPlant" component={AddPlant} />
      <Stack.Screen name="Camera" component={Camera} options={modal} />
      <Stack.Screen name="PlantForm" component={PlantForm} />
      {/* Opened from a tile, the plant flies in (shared element), so the page itself only fades. */}
      <Stack.Screen name="Plant" component={Plant} options={({ route }) => ({ animation: reduce ? 'none' : route.params?.from ? 'fade' : 'slide_from_right' })} />
      <Stack.Screen name="Care" component={Care} options={modal} />
      <Stack.Screen name="Plans" component={Plans} options={modal} />
      <Stack.Screen name="Experience" component={Experience} />
      <Stack.Screen name="Nudges" component={Nudges} />
      <Stack.Screen name="About" component={About} />
      <Stack.Screen name="Round" component={Round} options={{ presentation: 'fullScreenModal', animation: reduce ? 'none' : 'slide_from_bottom' }} />
    </Stack.Navigator>
    {/* The profile is asked for after the first watering, and required after the second. */}
    <ProfileInvite />
  </NavigationContainer>;
}

/**
 * On the web preview, a phone-width column so layouts match the device; on wide screens it
 * is framed like a phone, so it reads as a preview rather than a broken desktop site.
 * Native fills the screen.
 */
function Shell({ children }: React.PropsWithChildren) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width >= 720 && height >= 700;
  return <View style={{ flex: 1, backgroundColor: c.sunken, alignItems: 'center', justifyContent: framed ? 'center' : undefined }}>
    <View style={[{ flex: framed ? undefined : 1, width: '100%', maxWidth: Platform.OS === 'web' ? 440 : undefined, backgroundColor: c.canvas },
      framed && { height: Math.min(900, height - 48), width: 420, borderRadius: 44, overflow: 'hidden', borderWidth: 1, borderColor: c.hairline, shadowColor: c.shadow, shadowOpacity: 1, shadowRadius: 40, shadowOffset: { width: 0, height: 20 } }]}>{children}</View>
  </View>;
}

export default function App() {
  const [loaded, error] = useFonts({ InstrumentSans_400Regular, InstrumentSans_400Regular_Italic, InstrumentSans_500Medium, InstrumentSans_600SemiBold, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold });
  // Artwork loads alongside the fonts so no animation starts with a missing layer.
  const [images, setImages] = React.useState(false);
  // The saved language is read before the first screen, so nothing flashes in the wrong one.
  React.useEffect(() => { Promise.all([preloadImages(), loadLang()]).finally(() => setImages(true)); }, []);
  const ready = (loaded || !!error) && images;
  React.useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => undefined); }, [ready]);
  if (!ready) return <View style={{ flex: 1 }} />;
  if (error) return <Text style={{ padding: 40 }}>{t("Fonts didn’t load. Restart the app.")}</Text>;
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider>
        <Shell>
          <StatusBar style="auto" />
          {showGallery ? <Gallery /> : <StoreProvider><Navigator /></StoreProvider>}
        </Shell>
      </ThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>;
}
