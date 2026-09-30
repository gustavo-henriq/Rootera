"""The Plant Twin is the guidance: one set of rules decides which check is current.

These tests guard the promises that matter most: no invented numbers, and no two parts of
the twin disagreeing about the soil.
"""
from datetime import datetime, timedelta, timezone

from conftest import ALICE
from test_guidance import e, project


def at(hours=0):
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()


def check(id, soil, hours):
    return {'id': id, 'type': 'Soil check', 'soil': soil, 'observed_at': at(hours)}


def numbers_about_moisture(value, path=''):
    """Every key in the twin that could carry a moisture figure."""
    if isinstance(value, dict):
        for k, v in value.items():
            if 'moisture' in k or 'percent' in k:
                yield f'{path}.{k}'
            yield from numbers_about_moisture(v, f'{path}.{k}')
    elif isinstance(value, list):
        for i, v in enumerate(value):
            yield from numbers_about_moisture(v, f'{path}[{i}]')


def test_an_unsure_check_replaces_an_earlier_dry_one():
    # Dry five hours ago, "not sure" an hour ago: the dry report is no longer current.
    g = project([e('dry', 'Soil check', {'soil': 'dry'}, 5), e('unsure', 'Soil check', {'soil': 'not_sure'}, 1)], {'kind': 'monstera'})
    assert g['soil'] is None and g['action'] != 'log_water'


def test_the_api_twin_follows_the_same_rule(planted):
    planted.post('/v1/plants/aloe-1/user-observations', json=check('dry', 'dry', 5), headers=ALICE)
    planted.post('/v1/plants/aloe-1/user-observations', json=check('unsure', 'not_sure', 1), headers=ALICE)
    twin = planted.get('/v1/plants/aloe-1/twin', headers=ALICE).json()
    lean = planted.get('/v1/garden', headers=ALICE).json()['twins']['aloe-1']
    # One answer everywhere: the full twin and the garden snapshot agree, and neither calls the soil dry.
    assert twin['guidance']['soil'] is None and lean['guidance']['soil'] is None
    assert twin['guidance']['action'] == lean['guidance']['action']
    assert 'reported' not in twin and 'inferred' not in twin


def test_a_twin_never_carries_a_moisture_figure(planted):
    planted.post('/v1/plants/aloe-1/user-observations', json=check('wet', 'wet', 2), headers=ALICE)
    planted.post('/v1/plants/aloe-1/user-observations', json={'id': 'w', 'type': 'Watered', 'amount_ml': 250, 'observed_at': at(1)}, headers=ALICE)
    twin = planted.get('/v1/plants/aloe-1/twin', headers=ALICE).json()
    assert list(numbers_about_moisture(twin)) == []
    assert twin['sources'].keys() == {'user', 'external', 'reference'}


def test_records_are_read_in_the_order_they_happened():
    # Delivered out of order: the dry check happened last, so it is the current one.
    g = project([e('late', 'Soil check', {'soil': 'dry'}, 1), e('early', 'Soil check', {'soil': 'wet'}, 20)], {'kind': 'monstera'})
    assert g['soil'] == 'dry'


def test_a_watering_retires_the_check_before_it():
    g = project([e('dry', 'Soil check', {'soil': 'dry'}, 3), e('w', 'Watered', {}, 1)], {'kind': 'monstera'})
    assert g['soil'] is None and g['last_watered_at'] is not None


def test_future_records_wait_their_turn():
    g = project([e('later', 'Soil check', {'soil': 'dry'}, -3)], {'kind': 'monstera'})
    assert g['soil'] is None and g['evidence_ids'] == []


def test_the_twin_is_rebuilt_the_same_after_a_restart(planted):
    planted.post('/v1/plants/aloe-1/user-observations', json=check('dry', 'dry', 1), headers=ALICE)
    first = planted.get('/v1/plants/aloe-1/twin', headers=ALICE).json()
    rebuilt = planted.post('/v1/plants/aloe-1/twin/rebuild', headers=ALICE).json()
    for key in ('soil', 'action', 'title', 'state'):
        assert rebuilt['guidance'][key] == first['guidance'][key]
    assert rebuilt['evidence_count'] == first['evidence_count'] == 1
    assert rebuilt['engine_version'] == first['engine_version']

