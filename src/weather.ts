/**
 * Local weather, turned on by the caregiver. The phone's position is read once, at the
 * lowest accuracy, and only rounded coordinates (about 10 km) and the city name leave the
 * phone; the server fetches the weather (Open-Meteo) and adjusts the drying windows.
 * Nothing runs in the background.
 */
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { api } from './api';
import { t } from './i18n';

export type WeatherOutcome = 'on' | 'denied' | 'unavailable';

export async function enableLocalWeather(): Promise<WeatherOutcome> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return 'denied';
    const last = await Location.getLastKnownPositionAsync();
    const pos = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
    const lat = Math.round(pos.coords.latitude * 10) / 10, lon = Math.round(pos.coords.longitude * 10) / 10;
    // The city name, from the phone's own geocoder, only for display ("Weather in São Paulo").
    let place: string | undefined;
    try {
      const [p] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      place = p?.city || p?.subregion || p?.region || undefined;
    } catch { /* the weather works without a name */ }
    await api.setLocation({ lat, lon, place });
    return 'on';
  } catch {
    return 'unavailable';
  }
}

/** Turn the weather on and say plainly why when it can't be. */
export async function askForLocalWeather(): Promise<boolean> {
  const r = await enableLocalWeather();
  if (r === 'denied') Alert.alert(t('Location is off'), t('Allow location for Rootera in Settings to use the local weather.'));
  else if (r === 'unavailable') Alert.alert(t('Weather unavailable'), t('Your location couldn’t be read. Try again later.'));
  return r === 'on';
}

export async function disableLocalWeather() {
  await api.clearLocation();
}
