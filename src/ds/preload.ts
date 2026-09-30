/**
 * Every image the app shows, loaded before the first screen. Without this, each
 * layer arrives on its own (in Expo Go they are fetched from the dev server the
 * first time), so parts of an animation pop in late: the O of the wordmark
 * vanishes, a pot shows up after its seed, plant tiles appear one by one.
 */
import { Image, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { plantArt } from './plant';

const modules = [
  ...Object.values(plantArt),
  require('../../assets/logo/letters.webp'),
  require('../../assets/logo/o.webp'),
  require('../../assets/logo/sprout.webp'),
  require('../../assets/logo.png'),
  require('../../assets/flower/0-empty.webp'),
  require('../../assets/flower/seed-sprite.webp'),
  require('../../assets/flower/5-bloom.webp'),
  require('../../assets/scenes/few.webp'),
  require('../../assets/scenes/garden-group.webp'),
];

export async function preloadImages() {
  try {
    const assets = await Asset.loadAsync(modules);
    // On the web the files must also be decoded by the browser, not just resolved.
    if (Platform.OS === 'web') await Promise.all(assets.map(a => Image.prefetch(a.localUri ?? a.uri).catch(() => false)));
  } catch {
    // Never block the app on artwork; images will load on demand instead.
  }
}
