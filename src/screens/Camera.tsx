import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from '@react-navigation/native';
import { Props } from '../navigation';
import { useTheme } from '../ds/theme';
import { radius, space } from '../ds/tokens';
import { Btn, GlassIcon, T } from '../ds/components';
import { Page } from '../ds/Page';
import { Ground, PlantArt } from '../ds/plant';

/** Base64 of photos taken in this session, kept in memory for identification (not in navigation state). */
export const photoData = new Map<string, string>();

export function Camera({ navigation }: Props<'Camera'>) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');
  const focused = useIsFocused();

  const use = (uri: string, base64?: string | null) => {
    if (base64) photoData.set(uri, base64);
    navigation.replace('AddPlant', { photo: uri });
  };
  const capture = async () => {
    if (busy || !camera.current || !ready) return;
    setBusy(true); setError('');
    try {
      const shot = await camera.current.takePictureAsync({ quality: .6, base64: true });
      if (shot) use(shot.uri, shot.base64);
    } catch { setError('The photo didn’t work. Try again or pick one from your photos.'); }
    finally { setBusy(false); }
  };
  const gallery = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .6, base64: true, allowsEditing: true, aspect: [4, 5] });
      if (!r.canceled) use(r.assets[0].uri, r.assets[0].base64);
    } catch { setError('Could not open your photos. Please try again.'); }
    finally { setBusy(false); }
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: c.canvas }} />;

  if (!permission.granted || unavailable) {
    return <Page close={navigation.goBack} footer={<>
      {!unavailable && permission.canAskAgain && <Btn title="Allow camera" icon="camera" onPress={() => void requestPermission()} />}
      <Btn title="Choose from photos" kind="outline" icon="photos" busy={busy} onPress={() => void gallery()} />
    </>}>
      <View style={{ alignItems: 'center', gap: space[4], paddingTop: space[8] }}>
        <PlantArt kind="pothos" size={150} />
        <Ground width={140} style={{ marginTop: -14 }} />
        <T v="title" center>{unavailable ? 'No camera here' : 'Start from a photo'}</T>
        <T v="callout" tone="ink2" center>{unavailable
          ? 'This device has no camera available. You can still use a photo from your library.'
          : permission.canAskAgain
            ? 'Rootera uses the camera only while this screen is open. The photo becomes your plant’s picture.'
            : 'Camera access is off for Rootera. Turn it on in Settings, or use a photo from your library.'}</T>
        {!!error && <T v="subhead" tone="danger" center>{error}</T>}
      </View>
    </Page>;
  }

  return <View style={{ flex: 1, backgroundColor: '#0B0E08' }}>
    {focused && <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} onMountError={() => setUnavailable(true)} />}
    <View style={{ position: 'absolute', top: insets.top + 6, left: space.gutter - 4 }}><GlassIcon name="close" label="Close camera" onPress={navigation.goBack} /></View>
    <View pointerEvents="none" style={{ position: 'absolute', top: '18%', alignSelf: 'center', width: 250, height: 320, borderRadius: radius.card, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' }} />
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + space[6], alignItems: 'center', gap: space[4] }}>
      <T v="subhead" center style={{ color: '#FFFFFF' }}>{error || 'Fit the whole plant in the frame'}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <GlassIcon name="photos" label="Choose from photos" onPress={() => void gallery()} />
        <Pressable accessibilityRole="button" accessibilityLabel="Take photo" disabled={busy || !ready} onPress={() => void capture()}
          style={({ pressed }) => ({ width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', padding: 5, opacity: busy || !ready ? .5 : pressed ? .75 : 1 })}>
          <View style={{ flex: 1, borderRadius: 34, backgroundColor: '#FFFFFF' }} />
        </Pressable>
        <View style={{ width: 44 }} />
      </View>
    </View>
  </View>;
}
