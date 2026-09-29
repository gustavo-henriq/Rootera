"""Local weather: an approximate place, a gentle adjustment, never a requirement."""
import httpx

from app.forecast import drying_window, weather_factor
from app.integrations import weather
from conftest import ALICE, plant_payload

HOME = {'kind': 'monstera', 'pot': 'Medium pot', 'light': 'Bright indirect light', 'environment': {'location': 'Indoors'}}


def test_open_meteo_is_read_and_cached():
    calls = []
    def handler(request):
        calls.append(request.url)
        return httpx.Response(200, json={'daily': {'time': ['2026-09-01', '2026-09-02', '2026-09-03'], 'et0_fao_evapotranspiration': [4.0, 5.0, None], 'temperature_2m_max': [30, 32], 'relative_humidity_2m_mean': [70, 74]}})
    client = httpx.Client(transport=httpx.MockTransport(handler))
    weather._cache.clear()
    w = weather.recent(-23.5512, -46.6333, client)
    assert w == {'et0': 4.5, 'tmax': 31.0, 'rh': 72, 'days': 2, 'daily': {'2026-09-01': 4.0, '2026-09-02': 5.0}}
    # Only the rounded place ever leaves the server.
    assert calls[0].params['latitude'] == '-23.6' and calls[0].params['longitude'] == '-46.6'
    assert weather.recent(-23.58, -46.61, client) == w and len(calls) == 1  # same place: cached


def test_an_unreachable_service_means_no_weather():
    def handler(request):
        raise httpx.ConnectError('down')
    weather._cache.clear()
    assert weather.recent(10, 10, httpx.Client(transport=httpx.MockTransport(handler))) is None


def test_hot_weeks_shorten_the_window_gently_indoors_more_outdoors():
    base = drying_window(HOME, 'half', [], None)
    hot = {'et0': 5.5}
    indoor = drying_window({**HOME, 'weather': hot}, 'half', [], None)
    outdoor = drying_window({**HOME, 'weather': hot, 'environment': {'location': 'Outdoors'}}, 'half', [], None)
    assert indoor['high_days'] < base['high_days'] and 'warm_dry_week' in indoor['factors']
    assert outdoor['high_days'] < indoor['high_days']
    cool = drying_window({**HOME, 'weather': {'et0': 1.2}}, 'half', [], None)
    assert cool['high_days'] > base['high_days'] and 'cool_humid_week' in cool['factors']
    # An ordinary week changes nothing, and the adjustment is bounded.
    assert weather_factor({**HOME, 'weather': {'et0': 3.5}}) == (None, 1.0)
    assert weather_factor({**HOME, 'environment': {'location': 'Outdoors'}, 'weather': {'et0': 30}})[1] == .8


def test_the_place_is_rounded_and_can_be_forgotten(client, monkeypatch):
    monkeypatch.setattr(weather, 'recent', lambda lat, lon, client=None: {'et0': 5.5, 'tmax': 31.0, 'rh': 70, 'days': 10})
    client.post('/v1/plants', json=plant_payload(), headers=ALICE)
    r = client.put('/v1/profile/location', json={'lat': -23.55123, 'lon': -46.63331, 'place': 'São Paulo'}, headers=ALICE)
    assert r.status_code == 200 and r.json()['location'] == {'lat': -23.6, 'lon': -46.6, 'place': 'São Paulo'}
    garden = client.get('/v1/garden', headers=ALICE).json()
    assert garden['weather']['et0'] == 5.5 and garden['location']['place'] == 'São Paulo'
    g = garden['twins']['aloe-1']['guidance']
    assert 'warm_dry_week' in g['forecast']['factors']
    assert client.delete('/v1/profile/location', headers=ALICE).json() == {'location': None, 'weather': None}
    garden = client.get('/v1/garden', headers=ALICE).json()
    assert garden['weather'] is None and 'location' not in garden
    assert client.put('/v1/profile/location', json={'lat': 200, 'lon': 0}, headers=ALICE).status_code == 422


def test_cycles_already_carry_their_weather():
    from datetime import datetime, timedelta, timezone
    start = datetime(2026, 9, 1, tzinfo=timezone.utc)
    spans = [(start + timedelta(days=9 * i), 8.0) for i in range(3)]
    hot = {f'2026-09-{d:02d}': 5.5 for d in range(1, 31)}
    # Learned in a hot month and still hot: no adjustment (it would count the heat twice).
    same = drying_window({**HOME, 'weather': {'et0': 5.5, 'daily': hot}}, 'half', [8 * 24.0] * 3, None, spans)
    plain = drying_window(HOME, 'half', [8 * 24.0] * 3, None, spans)
    assert 'warm_dry_week' not in same['factors'] and (same['low_days'], same['high_days']) == (plain['low_days'], plain['high_days'])
    # Learned in the heat, now a cool, humid week: the soil will take longer.
    cooler = drying_window({**HOME, 'weather': {'et0': 2.0, 'daily': hot}}, 'half', [8 * 24.0] * 3, None, spans)
    assert 'cool_humid_week' in cooler['factors'] and cooler['high_days'] > plain['high_days']
