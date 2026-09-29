"""Local weather from Open-Meteo (https://open-meteo.com), no key needed.

The server asks for the last 92 days and the next 3 at the caregiver's approximate place
(coordinates rounded to 0.1°, about 10 km, before they are ever stored) and keeps:
- et0: reference evapotranspiration (mm/day), how much water the air pulls from wet soil,
  the one number that best says "the soil dries faster this week";
- tmax: mean daily maximum temperature (°C) and rh: mean relative humidity (%), for the
  words the app shows.
Answers are cached per place for three hours. If Open-Meteo is unreachable, the app goes
on without the weather (it is an adjustment, never a requirement).

Licence: Open-Meteo's free API is for non-commercial use; a paid plan (or Apple WeatherKit)
is needed once Rootera+ is sold.
"""
from statistics import mean
from time import monotonic

import httpx

API = 'https://api.open-meteo.com/v1/forecast'
TTL = 3 * 3600
_cache: dict[tuple[float, float], tuple[float, dict | None]] = {}


def place(lat: float, lon: float) -> tuple[float, float]:
    """The only precision Rootera keeps: 0.1° (about 10 km)."""
    return round(lat, 1), round(lon, 1)


def summarize(daily: dict) -> dict | None:
    """The week (the last 10 values: 7 past days and 3 forecast) and, by date, the ET0 of
    every day received, so learned cycles can be compared with the weather they had."""
    week = lambda name: [v for v in (daily.get(name) or [])[-10:] if v is not None]
    et0, tmax, rh = week('et0_fao_evapotranspiration'), week('temperature_2m_max'), week('relative_humidity_2m_mean')
    if not et0:
        return None
    history = {d: v for d, v in zip(daily.get('time') or [], daily.get('et0_fao_evapotranspiration') or []) if v is not None}
    return {'et0': round(mean(et0), 2), 'tmax': round(mean(tmax), 1) if tmax else None, 'rh': round(mean(rh)) if rh else None, 'days': len(et0), 'daily': history}


def recent(lat: float, lon: float, client: httpx.Client | None = None) -> dict | None:
    key = place(lat, lon)
    hit = _cache.get(key)
    if hit and monotonic() - hit[0] < TTL:
        return hit[1]
    own = client is None
    client = client or httpx.Client(timeout=4)
    try:
        response = client.get(API, params={'latitude': key[0], 'longitude': key[1], 'past_days': 92, 'forecast_days': 3, 'timezone': 'auto',
                                           'daily': 'et0_fao_evapotranspiration,temperature_2m_max,relative_humidity_2m_mean'})
        daily = response.json().get('daily', {}) if response.status_code == 200 else {}
        out = summarize(daily)
    except (httpx.HTTPError, ValueError):
        out = None
    finally:
        if own:
            client.close()
    # Failures are cached too, briefly, so a slow service does not slow every garden load.
    _cache[key] = (monotonic() - (TTL - 600 if out is None else 0), out)
    return out
