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
  require('../../assets/plants/aloe-pot.png'),
  require('../../assets/plants/aloe-foliage.png'),
  require('../../assets/plants/sprout-grow.png'),
  require('../../assets/logo/letters.png'),
  require('../../assets/logo/o.png'),
  require('../../assets/logo/sprout.png'),
  require('../../assets/logo.png'),
  require('../../assets/flower/1-seed.png'),
  require('../../assets/flower/2-sprout.png'),
  require('../../assets/flower/3-leaves.png'),
  require('../../assets/flower/4-bud.png'),
  require('../../assets/flower/5-bloom.png'),
  require('../../assets/scenes/few.png'),
  require('../../assets/scenes/garden.jpg'),
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
