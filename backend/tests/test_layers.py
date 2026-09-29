"""Soil checks in three layers: surface, middle and bottom, judged at the species' depth."""
from datetime import datetime, timedelta, timezone

from app.domain import Evidence
from app.guidance import SensorlessGuidance, cycles
from app.soil import summarize
from conftest import ALICE, plant_payload

NOW = datetime(2026, 9, 9, tzinfo=timezone.utc)


def e(id, kind, value, hours=0):
    return Evidence(id, 'USER', kind, value, (NOW - timedelta(hours=hours)).isoformat(), .65)


def check(id, top, middle, bottom, hours=0, dryness='top'):
    layers = {'top': top, 'middle': middle, 'bottom': bottom}
    return e(id, 'Soil check', {'soil': summarize(layers, dryness), 'layers': layers}, hours)


def project(events, kind):
    return SensorlessGuidance().project({'kind': kind}, {}, events, NOW)


def test_the_species_depth_decides_what_dry_means():
    half_dry = {'top': 'dry', 'middle': 'moist', 'bottom': 'moist'}
    assert summarize(half_dry, 'top') == 'dry'  # a pothos is ready when the top dries
    assert summarize(half_dry, 'half') == 'slightly_moist'  # a monstera is drying, not dry
    assert summarize(half_dry, 'full') == 'slightly_moist'
    assert summarize({'top': 'dry', 'middle': 'dry', 'bottom': 'moist'}, 'half') == 'dry'
    assert summarize({'top': 'dry', 'middle': 'dry', 'bottom': 'moist'}, 'full') == 'slightly_moist'
    assert summarize({'top': 'dry', 'middle': 'dry', 'bottom': 'dry'}, 'full') == 'dry'
    assert summarize({'top': 'moist', 'middle': 'moist', 'bottom': 'moist'}, 'top') == 'moist'
    assert summarize({'top': 'wet', 'middle': 'dry', 'bottom': 'dry'}, 'full') == 'wet'
    # A surface plant with a soaked middle is not ready, whatever the top says.
    assert summarize({'top': 'dry', 'middle': 'wet', 'bottom': 'wet'}, 'top') == 'slightly_moist'


def test_an_unreached_bottom_is_never_dry_for_a_plant_that_dries_through():
    reached_half = {'top': 'dry', 'middle': 'dry', 'bottom': 'unreached'}
    assert summarize(reached_half, 'full') == 'slightly_moist'
    assert summarize(reached_half, 'half') == 'dry'  # the bottom does not decide for a monstera
    g = project([check('c', 'dry', 'dry', 'unreached', dryness='full')], 'aloe')
    assert g['action'] == 'wait' and 'bottom decides' in g['reason'] and 'skewer' in g['tip']


def test_water_at_the_bottom_outranks_a_dry_surface():
    # A pothos is watered when its top dries, but not while the bottom of the pot is wet.
    g = project([check('c', 'dry', 'moist', 'wet')], 'pothos')
    assert g['title'] == 'The bottom is still wet' and g['action'] == 'wait'
    assert g['soil_layers'] == {'top': 'dry', 'middle': 'moist', 'bottom': 'wet'}
    worse = SensorlessGuidance().project({'kind': 'pothos', 'drainage': 'No'}, {}, [check('c', 'dry', 'moist', 'wet')], NOW)
    assert 'drainage' in worse['reason'] and 'Pot details you added' in worse['basis']


def test_a_watering_that_did_not_reach_the_bottom_is_named():
    events = [e('w', 'Watered', {}, hours=20), check('c', 'wet', 'moist', 'dry', hours=2)]
    g = project(events, 'pothos')
    assert 'may not have reached it' in g['reason'] and 'drainage hole' in g['tip']
    # Days later a dry bottom is just drying, not a missed watering.
    later = [e('w', 'Watered', {}, hours=120), check('c', 'moist', 'moist', 'dry', hours=1)]
    assert 'may not have reached' not in project(later, 'pothos')['reason']


def test_layered_checks_close_and_narrow_cycles():
    # Monstera: the top dries first (drying, narrows the cycle), then the middle (dry, closes it).
    events = [e('w', 'Watered', {}, hours=120), check('a', 'dry', 'moist', 'moist', hours=72, dryness='half'),
              check('b', 'dry', 'dry', 'moist', hours=24, dryness='half')]
    timed = sorted(((datetime.fromisoformat(x.at), x) for x in events), key=lambda p: p[0])
    found, dried = cycles(timed)
    assert found == [96.0] and dried == [(48 + 96) / 2]


def test_the_api_keeps_the_layers_and_derives_the_reading(planted):
    at = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    body = {'id': 'layers-1', 'type': 'Soil check', 'note': '', 'observed_at': at, 'layers': {'top': 'dry', 'middle': 'dry', 'bottom': 'moist'}}
    r = planted.post('/v1/plants/aloe-1/user-observations', json=body, headers=ALICE)
    assert r.status_code == 201, r.text
    # An aloe dries through: dry on top and in the middle, moist at the bottom, is not dry yet.
    event = next(x for x in planted.get('/v1/garden', headers=ALICE).json()['events'] if x['id'] == 'layers-1')
    assert event['soil'] == 'slightly_moist' and event['layers'] == body['layers']
    # The same id and the same answers are a duplicate, not a conflict.
    assert planted.post('/v1/plants/aloe-1/user-observations', json=body, headers=ALICE).json()['duplicate'] is True


def test_layers_are_validated(planted):
    at = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    base = {'type': 'Soil check', 'note': '', 'observed_at': at}
    bad = [
        {**base, 'id': 'x1', 'layers': {'top': 'unreached', 'middle': 'dry', 'bottom': 'dry'}},  # only the bottom can be out of reach
        {**base, 'id': 'x2', 'layers': {'top': 'dry', 'middle': 'dry'}},  # all three layers
        {**base, 'id': 'x3', 'type': 'Watered', 'layers': {'top': 'dry', 'middle': 'dry', 'bottom': 'dry'}},
        {**base, 'id': 'x4', 'layers': {'top': 'dry', 'middle': 'dry', 'bottom': 'dry', 'roots': 'dry'}},
    ]
    for body in bad:
        assert planted.post('/v1/plants/aloe-1/user-observations', json=body, headers=ALICE).status_code == 422, body['id']
    # Single-reading checks (older app versions, older records) still work.
    old = {**base, 'id': 'x5', 'soil': 'moist'}
    assert planted.post('/v1/plants/aloe-1/user-observations', json=old, headers=ALICE).status_code == 201
