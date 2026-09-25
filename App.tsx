import React from 'react';
import { ActivityIndicator, Platform, View, Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts, NunitoSans_400Regular, NunitoSans_700Bold, NunitoSans_800ExtraBold, NunitoSans_900Black } from '@expo-google-fonts/nunito-sans';
import { StoreProvider, useStore } from './src/store';
import { Routes } from './src/navigation';
import { Welcome, Email, Onboarding } from './src/onboarding';
import { Main, Details, LogCare, Notifications, Settings, Article } from './src/garden';
import { AddPlant, Camera, Search, Result, Register } from './src/plants';
import { Plans, Checkout, Success } from './src/plans';

import { C, useReducedMotion } from './src/ui';
const Stack = createNativeStackNavigator<Routes>();
function Navigator() { const { ready, data } = useStore(); const reduce = useReducedMotion(); if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={C.green}/></View>; return <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, card: C.bg, text: C.ink, primary: C.green } }}><Stack.Navigator initialRouteName={data.onboarded ? 'Main' : 'Onboarding'} screenOptions={{ headerShown: false, animation: reduce ? 'none' : 'slide_from_right', contentStyle: { backgroundColor: C.bg } }}><Stack.Screen name="Welcome" component={Welcome}/><Stack.Screen name="Email" component={Email}/><Stack.Screen name="Onboarding" component={Onboarding}/><Stack.Screen name="Main" component={Main}/><Stack.Screen name="AddPlant" component={AddPlant}/><Stack.Screen name="Camera" component={Camera}/><Stack.Screen name="Search" component={Search}/><Stack.Screen name="Result" component={Result}/><Stack.Screen name="Register" component={Register}/><Stack.Screen name="Details" component={Details}/><Stack.Screen name="LogCare" component={LogCare}/><Stack.Screen name="Plans" component={Plans}/><Stack.Screen name="Checkout" component={Checkout} options={{ presentation: 'modal', animation: reduce ? 'none' : 'slide_from_bottom' }}/><Stack.Screen name="Success" component={Success}/><Stack.Screen name="Notifications" component={Notifications}/><Stack.Screen name="Settings" component={Settings}/><Stack.Screen name="Article" component={Article}/></Stack.Navigator></NavigationContainer>; }
export default function App() { const [loaded, error] = useFonts({ NunitoSans_400Regular, NunitoSans_700Bold, NunitoSans_800ExtraBold, NunitoSans_900Black }); if (!loaded && !error) return <ActivityIndicator style={{ flex: 1 }} color={C.green}/>; if (error) return <Text>Could not load app fonts. Please restart Rootera.</Text>; return <View style={{ flex: 1, backgroundColor: '#E7EBDD', alignItems: 'center' }}><View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 420 : undefined, backgroundColor: C.bg }}><SafeAreaProvider><StatusBar style="dark"/><StoreProvider><Navigator/></StoreProvider></SafeAreaProvider></View></View>; }
