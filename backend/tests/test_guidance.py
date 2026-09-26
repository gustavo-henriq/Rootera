from datetime import datetime, timedelta, timezone
from app.domain import Evidence
from app.guidance import SensorlessGuidance
from conftest import ALICE, plant_payload

NOW = datetime(2026, 9, 9, tzinfo=timezone.utc)


def e(id, kind, value, hours=0, source='USER'):
    return Evidence(id, source, kind, value, (NOW - timedelta(hours=hours)).isoformat(), .65)


def project(events, plant=None, caregiver=None):
    return SensorlessGuidance().project(plant or {'kind': 'aloe'}, caregiver or {}, events, NOW)


def test_no_fake_metrics_or_sensor_dependency():
    g = project([e('device', 'SoilMoistureMeasured', {'moisture': 5}, source='SENSOR')])
    assert g['state'] == 'NEW' and g['soil'] is None and g['action'] == 'check_soil'
    assert g['baseline_days'] is None and g['weather_connected'] is False
    assert '%' not in g['reason'] and 'Your soil check' not in g['basis']


def test_new_plant_starts_from_species_reference():
    g = project([], {'kind': 'peace-lily'})
    assert g['basis'] == ['Species reference'] and 'moist' in g['reference']['summary']


def test_dry_soil_uses_declared_pot_context():
    g = project([e('soil', 'Soil check', {'soil': 'dry'})], {'kind': 'aloe', 'drainage': 'No', 'self_watering': 'Yes'})
    assert 'drainage' in g['reason'] and 'reservoir' in g['reason']
    assert g['action'] == 'log_water' and 'Pot details you added' in g['basis']
    assert g['soil'] == 'dry'


def test_dry_advice_depends_on_species():
    aloe = project([e('soil', 'Soil check', {'soil': 'dry'})], {'kind': 'aloe'})
    lily = project([e('soil', 'Soil check', {'soil': 'dry'})], {'kind': 'peace-lily'})
    assert aloe['reason'] != lily['reason']


def test_unknown_answer_does_not_reuse_old_claim_or_ask_again():
    g = project([e('old', 'Soil check', {'soil': 'wet'}, 2), e('new', 'Soil check', {'soil': 'not_sure'})])
    assert g['soil'] is None
    assert g['action'] == 'wait' and g['title'] == 'No clear answer yet'


def test_watering_invalidates_previous_report():
    g = project([e('soil', 'Soil check', {'soil': 'dry'}, 2), e('water', 'Watered', {})])
    assert g['soil'] is None and g['title'] == 'Watering recorded' and g['action'] == 'wait'


def test_moist_soil_does_not_ask_for_another_check():
    g = project([e('soil', 'Soil check', {'soil': 'moist'})])
    assert g['action'] == 'wait' and g['title'] == 'Still moist'


def test_old_history_asks_for_a_fresh_check_with_reason():
    g = project([e('soil', 'Soil check', {'soil': 'moist'}, 72)])
    assert g['action'] == 'check_soil' and '3 days ago' in g['reason']


def test_baseline_requires_separate_cycles():
    events = []
    for i, hours in enumerate([240, 160, 80]):
        events += [e(f'w{i}', 'Watered', {}, hours), e(f'd{i}', 'Soil check', {'soil': 'dry'}, hours - 48)]
    assert project(events[:-2])['baseline_days'] is None
    g = project(events)
    assert g['baseline_days'] == 2 and g['completed_cycles'] == 3
    assert g['learning'] == 'Pattern found' and g['state'] == 'PATTERN'


def test_pattern_explains_timing_without_a_schedule():
    events = []
    for i, hours in enumerate([400, 300, 200]):
        events += [e(f'w{i}', 'Watered', {}, hours), e(f'd{i}', 'Soil check', {'soil': 'dry'}, hours - 96)]
    events.append(e('w-last', 'Watered', {}, 30))
    g = project(events)
    assert g['title'] == 'Probably not dry yet' and g['action'] == 'wait'
    assert 'about 4 days' in g['reason'] and 'every' not in g['reason']
    later = SensorlessGuidance().project({'kind': 'aloe'}, {}, events, NOW + timedelta(days=3))
    assert later['action'] == 'check_soil' and later['title'] == 'Around when it usually dries'


def test_visual_check_is_not_a_diagnosis():
    g = project([e('visual', 'Observation', {'visual': 'unwell'})])
    assert g['title'] == 'Check the soil next' and g['state'] == 'LEARNING' and g['action'] == 'check_soil'


def test_new_context_and_visual_observation_persist(client):
    payload = plant_payload()
    payload.update(environment={'location': 'Indoors', 'near_window': 'Yes'}, substrate='Dense / holds water', drainage='No', stage='Young')
    assert client.post('/v1/plants', json=payload, headers=ALICE).status_code == 201
    profile = {'name': 'Maya', 'onboarded': True, 'reminders': True, 'caregiver': {'experience': 'many', 'detail': 'Concise'}}
    assert client.patch('/v1/profile', json=profile, headers=ALICE).status_code == 200
    observation = {'id': 'look', 'type': 'Observation', 'visual': 'different', 'observed_at': datetime.now(timezone.utc).isoformat()}
    assert client.post('/v1/plants/aloe-1/user-observations', json=observation, headers=ALICE).status_code == 201
    garden = client.get('/v1/garden', headers=ALICE).json()
    assert garden['caregiver']['experience'] == 'many'
    assert garden['plants'][0]['environment']['near_window'] == 'Yes'
    assert garden['events'][0]['visual'] == 'different'
    assert garden['twins']['aloe-1']['guidance']['visual'] == 'different'
    assert garden['twins']['aloe-1']['measured'] is None


def test_legacy_experience_values_remain_readable(client):
    profile = {'caregiver': {'experience': 'Plant nerd', 'plant_count': '4–10', 'detail': 'Guided'}}
    assert client.patch('/v1/profile', json=profile, headers=ALICE).json()['caregiver']['experience'] == 'many'


def test_visual_field_cannot_be_saved_as_watering(planted):
    r = planted.post('/v1/plants/aloe-1/user-observations', headers=ALICE, json={'id': 'invalid', 'type': 'Watered', 'visual': 'great', 'observed_at': datetime.now(timezone.utc).isoformat()})
    assert r.status_code == 422


def test_fresh_soil_resolves_visual_check_prompt():
    g = project([e('visual', 'Observation', {'visual': 'different'}, 1), e('soil', 'Soil check', {'soil': 'dry'})])
    assert g['action'] == 'observe' and g['title'] == 'Look at the leaves again tomorrow'


def test_unknown_visual_clears_previous_claim():
    g = project([e('old', 'Observation', {'visual': 'unwell'}, 1), e('new', 'Observation', {'visual': 'not_sure'})])
    assert g['visual'] is None and g['title'] != 'Check the soil next'


def test_stale_visual_is_not_a_current_check():
    assert project([e('old', 'Observation', {'visual': 'unwell'}, 25)])['visual'] is None


def test_concise_guidance_keeps_context_but_drops_tips():
    g = project([e('soil', 'Soil check', {'soil': 'dry'})], {'kind': 'aloe', 'drainage': 'No', 'self_watering': 'Yes'}, {'detail': 'Concise'})
    assert 'drainage' in g['reason'] and 'reservoir' in g['reason'] and g['tip'] is None
    assert project([], {'kind': 'aloe'}, {'detail': 'Guided'})['tip']


def test_watering_after_visual_change_does_not_repeat_check():
    g = project([e('visual', 'Observation', {'visual': 'different'}, 1), e('water', 'Watered', {})])
    assert g['action'] == 'observe' and g['title'] == 'Look at the leaves in a day or two'


def test_unsure_soil_after_visual_change_does_not_ask_again():
    g = project([e('visual', 'Observation', {'visual': 'different'}, 1), e('soil', 'Soil check', {'soil': 'not_sure'})])
    assert g['action'] == 'wait'
