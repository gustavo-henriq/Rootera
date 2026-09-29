"""Ways around the rules a modified app (or a curious tester) might try."""
from datetime import datetime, timedelta, timezone

from conftest import ALICE, BOB, plant_payload

LAYERS = {'top': 'dry', 'middle': 'dry', 'bottom': 'dry'}


def ago(**kw):
    return (datetime.now(timezone.utc) - timedelta(**kw)).isoformat()


def test_a_plant_cannot_claim_to_be_the_example(client):
    # The example never counts toward the plan; a client cannot mark its own plant as one.
    r = client.post('/v1/plants', json={**plant_payload('sneaky'), 'example': True}, headers=ALICE)
    assert r.status_code == 422
    r = client.post('/v1/plants', json=plant_payload('mine'), headers=ALICE)
    assert client.patch('/v1/plants/mine', json={'example': True}, headers=ALICE).status_code == 422


def test_the_example_id_cannot_be_taken_from_another_account(client):
    # Bob taking Alice's example id must not block or reach her example.
    r = client.post('/v1/plants', json=plant_payload('example-alice'), headers=BOB)
    assert r.status_code in (201, 409)
    assert client.get('/v1/plants/example-alice/twin', headers=ALICE).status_code == 404


def test_layers_win_over_a_contradicting_single_reading(planted):
    body = {'id': 'mix', 'type': 'Soil check', 'note': '', 'observed_at': ago(minutes=1), 'soil': 'wet', 'layers': LAYERS}
    assert planted.post('/v1/plants/aloe-1/user-observations', json=body, headers=ALICE).status_code == 201
    event = next(e for e in planted.get('/v1/garden', headers=ALICE).json()['events'] if e['id'] == 'mix')
    assert event['soil'] == 'dry'  # the layers are what the caregiver actually reported


def test_records_cannot_come_from_the_future_or_the_wrong_kind(planted):
    base = {'type': 'Soil check', 'note': '', 'layers': LAYERS}
    future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assert planted.post('/v1/plants/aloe-1/user-observations', json={**base, 'id': 'f', 'observed_at': future}, headers=ALICE).status_code == 422
    watered = {'id': 'w', 'type': 'Watered', 'note': '', 'observed_at': ago(minutes=1), 'approximate': True, 'layers': LAYERS}
    assert planted.post('/v1/plants/aloe-1/user-observations', json=watered, headers=ALICE).status_code == 422
    naive = {**base, 'id': 'n', 'observed_at': datetime.now().replace(microsecond=0).isoformat()}
    assert planted.post('/v1/plants/aloe-1/user-observations', json=naive, headers=ALICE).status_code == 422


def test_an_archived_plant_takes_no_more_records(planted):
    assert planted.delete('/v1/plants/aloe-1?reason=given', headers=ALICE).status_code == 200
    body = {'id': 'late', 'type': 'Soil check', 'note': '', 'observed_at': ago(minutes=1), 'layers': LAYERS}
    assert planted.post('/v1/plants/aloe-1/user-observations', json=body, headers=ALICE).status_code == 404
    assert planted.patch('/v1/plants/aloe-1', json={'name': 'Back'}, headers=ALICE).status_code == 404


def test_lab_inputs_stay_in_bounds(client):
    ok = client.post('/v1/lab/simulate', json={'days': 14, 'overrides': [{'day': 30, 'water': True}]}, headers=ALICE)
    assert ok.status_code == 200 and len(ok.json()['days']) == 14  # a day past the run is ignored
    for bad in ({'days': 3}, {'pace': 9}, {'check_every': 0}, {'overrides': [{'day': -1}]}, {'overrides': [{'day': 2, 'leaves': 'dead'}]},
                {'overrides': [{'day': 2, 'layers': {'top': 'dry', 'middle': 'dry'}}]}, {'method': 'magic'}, {'pot': 'Bucket'}):
        assert client.post('/v1/lab/simulate', json=bad, headers=ALICE).status_code == 422, bad


def test_a_typed_check_is_never_skipped_in_the_lab(client):
    body = {'days': 7, 'method': 'manual', 'overrides': [{'day': 3, 'check': False, 'layers': {'top': 'wet', 'middle': 'wet', 'bottom': 'wet'}}]}
    day3 = client.post('/v1/lab/simulate', json=body, headers=ALICE).json()['days'][3]
    assert any(e['type'] == 'check' and e['typed'] for e in day3['events'])
