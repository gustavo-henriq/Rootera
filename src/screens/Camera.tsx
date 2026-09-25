import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from '@react-navigation/native';
import { Props } from '../navigation';
import { color, space } from '../theme';
import { Button, Icon, IconButton, PlantArt, Txt } from '../ui';

/** Base64 of photos taken in this session, kept in memory for identification (not in navigation state). */
export const photoData = new Map<string, string>();

export function Camera({ navigation, route }: Props<'Camera'>) {
  const first = !!route.params?.first;
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');
  const focused = useIsFocused();

  const use = (uri: string, base64?: string | null) => {
    if (base64) photoData.set(uri, base64);
    navigation.replace('AddPlant', { first, photo: uri });
  };

  const capture = async () => {
    if (busy || !camera.current || !ready) return;
    setBusy(true); setError('');
    try {
      const shot = await camera.current.takePictureAsync({ quality: .6, base64: true });
      if (shot) use(shot.uri, shot.base64);
    } catch { setError('The photo didn’t work. Try again or pick one from your gallery.'); }
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

  if (!permission) return <View style={{ flex: 1, backgroundColor: color.ink }} />;

  if (!permission.granted || unavailable) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: color.paper }}>
      <View style={{ paddingHorizontal: 8 }}><IconButton name="close" label="Close" onPress={navigation.goBack} /></View>
      <View style={{ flex: 1, padding: space.gutter, justifyContent: 'center', gap: space.lg }}>
        <View style={{ alignItems: 'center' }}><PlantArt kind="pothos" size={150} /></View>
        <Txt v="title" center>{unavailable ? 'No camera here' : 'Start from a photo'}</Txt>
        <Txt center tone={color.inkSoft}>{unavailable
          ? 'This device has no camera available. You can still use a photo from your gallery.'
          : 'Rootera uses the camera only while this screen is open. The photo becomes your plant’s picture.'}</Txt>
        {!!error && <Txt v="small" center tone={color.danger}>{error}</Txt>}
      </View>
      <View style={{ padding: space.gutter, gap: space.sm }}>
        {!unavailable && permission.canAskAgain && <Button title="Allow camera" icon="camera-outline" onPress={() => void requestPermission()} />}
        {!unavailable && !permission.canAskAgain && <Txt v="small" center>Camera access is off for Rootera. Turn it on in Settings, or use a gallery photo.</Txt>}
        <Button title="Choose from gallery" variant="secondary" icon="images-outline" busy={busy} onPress={() => void gallery()} />
      </View>
    </SafeAreaView>;
  }

  return <View style={{ flex: 1, backgroundColor: '#11140D' }}>
    {focused && <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} onMountError={() => setUnavailable(true)} />}
    <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>
      <View style={{ paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' }}>
        <IconButton name="close" label="Close camera" tone={color.white} onPress={navigation.goBack} />
        <Txt v="smallStrong" tone={color.white} center style={{ flex: 1, marginRight: 44 }}>Fit the whole plant in the frame</Txt>
      </View>
      <View pointerEvents="none" style={{ alignSelf: 'center', width: 250, height: 320, borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' }} />
      <View style={{ paddingBottom: space.xl, gap: space.md }}>
        {!!error && <Txt v="small" center tone="#FFD9C7">{error}</Txt>}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
          <IconButton name="images-outline" label="Choose from gallery" tone={color.white} onPress={() => void gallery()} />
          <Pressable accessibilityRole="button" accessibilityLabel="Take photo" disabled={busy || !ready} onPress={() => void capture()}
            style={({ pressed }) => ({ width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: color.white, padding: 5, opacity: busy || !ready ? .5 : pressed ? .75 : 1 })}>
            <View style={{ flex: 1, borderRadius: 32, backgroundColor: color.white }} />
          </Pressable>
          <View style={{ width: 44 }}><Icon name="leaf-outline" size={20} tone="rgba(255,255,255,0.5)" /></View>
        </View>
      </View>
    </SafeAreaView>
  </View>;
}
