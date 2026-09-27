"""Hard cases found in the backend review (2026-09-27). Each test names the failure it guards."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.domain import Evidence, PlantTwinEngine
from app.forecast import drying_window
from app.guidance import SensorlessGuidance
from app.main import create_app
from conftest import ALICE, TOKENS
from test_guidance import NOW, e, project


def cycles(*days, start=None, approximate_first=False):
    """Waterings each followed by a dry check `days` later; the next watering right after it."""
    events, at = [], start if start is not None else sum(days) * 24 + 200
    for i, d in enumerate(days):
        value = {'approximate': True} if approximate_first and i == 0 else {}
        events.append(e(f'w{i}', 'Watered', value, at))
        events.append(e(f'd{i}', 'Soil check', {'soil': 'dry'}, at - d * 24))
        at -= d * 24 + 1
    return events


# 1. A phone clock a few minutes ahead: the record the server just accepted must count.
def test_a_check_slightly_in_the_future_counts_now():
    g = project([e('soon', 'Soil check', {'soil': 'dry'}, hours=-3 / 60)], {'kind': 'monstera'})
    assert g['action'] == 'log_water' and g['soil'] == 'dry'
    t = PlantTwinEngine().project('p', [e('soon', 'Soil check', {'soil': 'dry'}, hours=-3 / 60)], NOW)
    assert t['reported'] is not None


def test_far_future_records_still_wait():
    g = project([e('later', 'Soil check', {'soil': 'dry'}, hours=-2)], {'kind': 'monstera'})
    assert g['soil'] is None


# 2. A watering remembered roughly at setup is not a measured cycle start.
def test_approximate_watering_does_not_start_a_cycle():
    events = [e('w0', 'Watered', {'approximate': True}, 200), e('d0', 'Soil check', {'soil': 'dry'}, 1)]
    g = project(events, {'kind': 'monstera'})
    assert g['completed_cycles'] == 0 and g['forecast'] is None or g['forecast']['source'] == 'estimate'


def test_legacy_setup_note_is_read_as_approximate():
    for note in ('Approximate date, from setup', 'Data aproximada, da configuração'):
        events = [e('w0', 'Watered', {'note': note}, 200), e('d0', 'Soil check', {'soil': 'dry'}, 1)]
        assert project(events, {'kind': 'monstera'})['completed_cycles'] == 0


def test_cycles_after_the_approximate_one_still_count():
    g = project(cycles(9, 5, 6, 5, approximate_first=True), {'kind': 'monstera'})
    assert g['completed_cycles'] == 3 and g['state'] == 'PATTERN'


# 3. The pattern and the window agree on when to check.
def test_pattern_and_window_agree():
    events = cycles(5, 6, 5, start=500)
    for hours_since in (24 * 4.4, 24 * 5.2, 24 * 7):
        g = project(events + [e('w-last', 'Watered', {}, hours_since)], {'kind': 'monstera'})
        f = g['forecast']
        opened = datetime.fromisoformat(f['check_from']) <= NOW
        assert (g['action'] == 'check_soil') == opened, (hours_since, g['title'], f)


# 4. Old and odd cycles: recent ones count, one forgotten check does not blow the window up.
def test_one_forgotten_check_does_not_stretch_the_window():
    f = project(cycles(5, 6, 40, 5, 6), {'kind': 'monstera'})['forecast']
    assert f['high_days'] <= 8, f


def test_recent_cycles_outweigh_old_ones():
    old_winter = cycles(14, 15, 14, 15, 14, 15, start=24 * 200)
    summer = cycles(5, 5, 6, 5, 6, 5, start=24 * 60)
    g = project(old_winter + summer, {'kind': 'monstera'})
    assert g['baseline_days'] < 7 and g['forecast']['high_days'] <= 7, (g['baseline_days'], g['forecast'])


# 5. Dry at the last check, more than a day ago, and no watering since.
def test_stale_dry_check_is_named():
    events = [e('w', 'Watered', {}, 24 * 10), e('d', 'Soil check', {'soil': 'dry'}, 30)]
    g = project(events, {'kind': 'monstera'})
    assert g['action'] == 'check_soil' and 'dry' in g['reason'] and 'yesterday' in g['reason']


# 6. The twin's reported layer follows the latest check, whatever it said.
def test_twin_reports_the_latest_check():
    events = [e('d', 'Soil check', {'soil': 'dry'}, 5), e('s', 'Soil check', {'soil': 'slightly_moist'}, 1)]
    t = PlantTwinEngine().project('p', events, NOW)
    assert t['reported']['soil_condition'] == 'slightly_moist'


# 8. Small things.
def test_one_hour_is_singular():
    events = [e('w', 'Watered', {}, 30)] + [x for i in range(3) for x in (e(f'w{i}', 'Watered', {}, 200 + i * 50), e(f'd{i}', 'Soil check', {'soil': 'dry'}, 199 + i * 50))]
    g = project(events, {'kind': 'monstera', 'self_watering': 'Yes'})
    assert '1 hours' not in g['reason']


def test_window_rounds_to_the_nearest_day():
    f = drying_window({}, 'half', [4.96 * 24, 5.96 * 24, 4.96 * 24], None)
    assert (f['low_days'], f['high_days']) == (5, 6)


# 7. The example plant under concurrent first loads, and profile changes at the same time.
@pytest.fixture
def seeded(database_url):
    with TestClient(create_app(database_url, demo=False, tokens=TOKENS, seed_example=True)) as client:
        yield client


def test_concurrent_first_loads_add_one_example(seeded):
    with ThreadPoolExecutor(6) as pool:
        codes = list(pool.map(lambda _: seeded.get('/v1/garden', headers=ALICE).status_code, range(6)))
    assert codes == [200] * 6
    assert len([p for p in seeded.get('/v1/garden', headers=ALICE).json()['plants'] if p.get('example')]) == 1


def test_seeding_never_reverts_a_profile_change(seeded):
    seeded.patch('/v1/profile', json={'onboarded': True, 'name': 'Guto'}, headers=ALICE)
    garden = seeded.get('/v1/garden', headers=ALICE).json()
    assert garden['onboarded'] is True and garden['name'] == 'Guto'


def test_records_on_a_removed_plant_are_refused(seeded):
    plant_id = [p for p in seeded.get('/v1/garden', headers=ALICE).json()['plants'] if p.get('example')][0]['id']
    seeded.delete(f'/v1/plants/{plant_id}', headers=ALICE)
    r = seeded.post(f'/v1/plants/{plant_id}/user-observations', headers=ALICE,
                    json={'id': 'late', 'type': 'Watered', 'note': '', 'observed_at': datetime.now(timezone.utc).isoformat()})
    assert r.status_code == 404


def test_approximate_flag_round_trips(seeded):
    plant_id = [p for p in seeded.get('/v1/garden', headers=ALICE).json()['plants'] if p.get('example')][0]['id']
    r = seeded.post(f'/v1/plants/{plant_id}/user-observations', headers=ALICE,
                    json={'id': 'approx', 'type': 'Watered', 'note': '', 'approximate': True, 'observed_at': (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()})
    assert r.status_code == 201
    event = [x for x in seeded.get('/v1/garden', headers=ALICE).json()['events'] if x['id'] == 'approx'][0]
    assert event['approximate'] is True
    bad = seeded.post(f'/v1/plants/{plant_id}/user-observations', headers=ALICE,
                      json={'id': 'bad', 'type': 'Soil check', 'soil': 'dry', 'note': '', 'approximate': True, 'observed_at': datetime.now(timezone.utc).isoformat()})
    assert bad.status_code == 422
