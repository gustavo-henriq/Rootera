"""The Shipaton lab: a virtual plant and a simulated caregiver, run through the real engine."""
from datetime import datetime, timezone

from app.lab import DayInput, LabRun, layer_days, simulate
from conftest import ALICE

START = datetime(2026, 9, 1, tzinfo=timezone.utc)
HOME = {'pot': 'Medium pot', 'drainage': 'Yes', 'light': 'Bright indirect light'}


def run(kind='monstera', method='rootera', days=60, plant=HOME, **kw):
    return simulate(LabRun(kind=kind, plant=plant, method=method, days=days, **kw), START)


def test_checking_before_watering_learns_the_plant():
    for kind in ('monstera', 'pothos', 'aloe'):
        r = run(kind)
        s = r['summary']
        assert s['cycles'] >= 3 and s['wet_days'] == 0 and s['unwell_days'] == 0, (kind, s)
        # What Rootera learned is within a day of how this plant really dries.
        assert s['error_days'] is not None and s['error_days'] <= 1.0, (kind, s, r['truth'])


def test_watering_every_three_days_soaks_a_succulent_and_teaches_nothing():
    s = run('aloe', 'often')['summary']
    assert s['wet_days'] > 20 and s['unwell_days'] > 0
    # Never found dry after a watering: no cycles, so Rootera keeps the general estimate.
    assert s['cycles'] == 0 and s['window_source'] == 'estimate'


def test_a_forgotten_peace_lily_goes_thirsty_but_a_pothos_copes():
    s = run('peace-lily', 'forgetful')['summary']
    assert s['dry_days'] > 10 and s['unwell_days'] > 0
    # Pothos dries to a finger's depth and forgives a two-week gap (Clemson HGIC).
    assert run('pothos', 'forgetful')['summary']['unwell_days'] == 0


def test_pot_and_place_change_the_virtual_plant():
    base = layer_days('monstera', HOME, 1.0)
    small = layer_days('monstera', {**HOME, 'pot': 'Small pot'}, 1.0)
    shade = layer_days('monstera', {**HOME, 'light': 'Low light'}, 1.0)
    closed = layer_days('monstera', {**HOME, 'drainage': 'No'}, 1.0)
    assert small['middle'] < base['middle'] < shade['middle']
    assert closed['bottom'] > base['bottom'] * 2
    assert layer_days('monstera', HOME, .8)['middle'] < base['middle']


def test_the_tester_can_water_and_type_what_they_see():
    r = run('monstera', 'manual', days=14, overrides={
        0: DayInput(water=True),
        3: DayInput(layers={'top': 'dry', 'middle': 'wet', 'bottom': 'wet'}),
        5: DayInput(leaves='different'),
    })
    day0, day3, day5 = r['days'][0], r['days'][3], r['days'][5]
    assert {'type': 'water'} in day0['events']
    assert any(e['type'] == 'check' and e['typed'] and e['layers']['middle'] == 'wet' for e in day3['events'])
    assert any(e['type'] == 'leaves' and e['typed'] for e in day5['events'])
    # The engine answered the typed check: still wet in the middle, so wait.
    assert day3['guidance']['action'] == 'wait'


def test_every_day_carries_what_the_app_draws():
    r = run(days=21)
    assert len(r['days']) == 21 and r['plant']['name'] == 'MVP Shipaton'
    for d in r['days']:
        assert set(d['soil']) == {'top', 'middle', 'bottom'}
        assert d['guidance']['title'] and d['guidance']['action'] in ('check_soil', 'log_water', 'observe', 'wait')
    assert r['integrations'] == {'weather': False, 'photos': False}


def test_the_lab_route(client):
    body = {'kind': 'pothos', 'method': 'weekly', 'days': 21, 'overrides': [{'day': 2, 'water': True}, {'day': 4, 'leaves': 'different'}]}
    r = client.post('/v1/lab/simulate', json=body, headers={**ALICE, 'Accept-Language': 'pt-BR'})
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data['days']) == 21 and any(e['type'] == 'water' for e in data['days'][2]['events'])
    assert data['days'][0]['guidance']['title'] != data['days'][0]['guidance'].get('title_en')  # Portuguese titles
    assert client.post('/v1/lab/simulate', json={'days': 400}, headers=ALICE).status_code == 422
    assert client.post('/v1/lab/simulate', json={'kind': 'unicorn'}, headers=ALICE).status_code == 422
    assert client.post('/v1/lab/simulate', json={}).status_code in (401, 403)
    # Nothing is stored.
    assert client.get('/v1/garden', headers=ALICE).json()['plants'] == []


def test_real_climates_are_bundled_and_change_the_plant():
    from app.lab import climate_series
    spring, winter = climate_series('sp_spring'), climate_series('poa_winter')
    assert len(spring) >= 90 and len(winter) >= 90 and sum(winter) / len(winter) < sum(spring) / len(spring)
    cold = run('monstera', days=91, weather=winter)
    mild = run('monstera', days=91)
    # Winter: the cycles really take longer, and Rootera waters less often.
    assert sum(cold['truth']['real_cycle_days']) / len(cold['truth']['real_cycle_days']) > mild['truth']['dry_after_days'] * 1.15
    assert cold['summary']['waterings'] < mild['summary']['waterings']
    assert cold['summary']['wet_days'] == cold['summary']['dry_days'] == 0
