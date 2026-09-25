"""API integration tests use isolated, real SQLite databases and app lifespans."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import Device, TwinSnapshot
from app.main import create_app
from conftest import ALICE, BOB, TOKENS, plant_payload


def at(hours=0):
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()


def user_payload(id='care-1', type='Watered', **changes):
    return {'id': id, 'type': type, 'observed_at': at(), **changes}


def reading_payload(message_id='reading-1', raw_adc=2000, **changes):
    return {'message_id': message_id, 'raw_adc': raw_adc, 'calibration_version': 1,
            'observed_at': at(), **changes}


def ingest(client, device, payload):
    return client.post(f'/v1/devices/{device["id"]}/readings', json=payload, headers=device['headers'])


def test_user_care_and_sensor_history_remain_separate(planted, device):
    care = planted.post('/v1/plants/aloe-1/user-observations', json=user_payload(amount_ml=200), headers=ALICE)
    assert care.status_code == 201
    assert care.json()['twin']['measured'] is None
    assert ingest(planted, device, reading_payload()).status_code == 201
    user = planted.get('/v1/plants/aloe-1/user-observations', headers=ALICE).json()
    measured = planted.get('/v1/plants/aloe-1/sensor-observations', headers=ALICE).json()
    assert len(user) == len(measured) == 1
    assert user[0]['source'] == 'USER'
    assert user[0]['value']['amount_ml'] == 200
    assert 'normalized_percent' not in user[0]
    assert measured[0]['source'] == 'SENSOR'
    assert measured[0]['normalized_percent'] == 50
    assert measured[0]['raw_adc'] == 2000
    assert 'amount_ml' not in measured[0]
    garden = planted.get('/v1/garden', headers=ALICE).json()
    assert garden['events'][0]['source'] == 'USER'
    assert garden['sensors'][0]['source'] == 'SENSOR'


def test_repeated_user_request_is_idempotent_and_conflicting_reuse_rejected(planted):
    body = user_payload(amount_ml=200)
    first = planted.post('/v1/plants/aloe-1/user-observations', json=body, headers=ALICE)
    second = planted.post('/v1/plants/aloe-1/user-observations', json=body, headers=ALICE)
    assert first.status_code == second.status_code == 201
    assert first.json()['duplicate'] is False
    assert second.json()['duplicate'] is True
    assert first.json()['id'] == second.json()['id']
    conflict = planted.post('/v1/plants/aloe-1/user-observations', json={**body, 'amount_ml': 250}, headers=ALICE)
    assert conflict.status_code == 409
    assert len(planted.get('/v1/plants/aloe-1/user-observations', headers=ALICE).json()) == 1
    assert len(planted.get('/v1/plants/aloe-1/events', headers=ALICE).json()) == 1


def test_repeated_sensor_request_does_not_duplicate_evidence_or_events(planted, device):
    body = reading_payload(raw_adc=2900)
    first, second = ingest(planted, device, body), ingest(planted, device, body)
    assert first.status_code == second.status_code == 201
    assert first.json()['duplicate'] is False
    assert second.json()['duplicate'] is True
    assert first.json()['id'] == second.json()['id']
    assert ingest(planted, device, {**body, 'raw_adc': 2800}).status_code == 409
    assert len(planted.get('/v1/plants/aloe-1/sensor-observations', headers=ALICE).json()) == 1
    events = planted.get('/v1/plants/aloe-1/events', headers=ALICE).json()
    assert [e['type'] for e in events].count('SoilMoistureMeasured') == 1
    assert [e['type'] for e in events].count('LowSoilMoistureDetected') == 1


def test_delayed_reading_does_not_overwrite_latest_measurement(planted, device):
    assert ingest(planted, device, reading_payload('latest', 1800, observed_at=at(1))).status_code == 201
    assert ingest(planted, device, reading_payload('delayed', 2900, observed_at=at(2))).status_code == 201
    twin = planted.get('/v1/plants/aloe-1/twin', headers=ALICE).json()
    assert twin['measured']['soil_moisture_percent'] == 60
    assert twin['inferred']['status'] == 'observed'
    assert twin['evidence_count'] == 2
    garden = planted.get('/v1/garden', headers=ALICE).json()
    assert garden['sensors'][0]['moisture'] == 60


def test_calibration_versions_preserve_original_raw_and_normalized_history(planted, device):
    first = ingest(planted, device, reading_payload('old-calibration', 2000)).json()
    second_cal = planted.post(f'/v1/devices/{device["id"]}/calibrations', json={'dry': 3500, 'wet': 500}, headers=ALICE)
    assert second_cal.status_code == 201
    assert second_cal.json()['version'] == 2
    assert ingest(planted, device, reading_payload('new-calibration', 2000, calibration_version=2)).status_code == 201
    assert ingest(planted, device, reading_payload('buffered-old-calibration', 2500, calibration_version=1)).status_code == 201
    readings = planted.get('/v1/plants/aloe-1/sensor-observations', headers=ALICE).json()
    old = next(r for r in readings if r['id'] == first['id'])
    assert old['calibration_id'] == device['calibration']['id']
    assert old['raw_adc'] == 2000
    assert old['normalized_percent'] == 50
    assert len({r['calibration_id'] for r in readings}) == 2
    assert len(readings) == 3
    assert ingest(planted, device, reading_payload('unknown-version', calibration_version=3)).status_code == 409


def test_sensor_and_manual_disagreement_is_explainable_in_twin(planted, device):
    ingest(planted, device, reading_payload(raw_adc=1400))
    planted.post('/v1/plants/aloe-1/user-observations', json=user_payload(type='Soil check', soil='dry'), headers=ALICE)
    twin = planted.get('/v1/plants/aloe-1/twin', headers=ALICE).json()
    assert twin['measured']['soil_moisture_percent'] == 80
    assert twin['reported']['soil_condition'] == 'dry'
    assert twin['inferred']['status'] == 'check_sensor'
    assert len(twin['conflicts'][0]['evidence_ids']) == 2


def test_demo_sensor_is_stored_but_excluded_from_actual_twin(database_url):
    with TestClient(create_app(database_url, demo=True, tokens=TOKENS)) as client:
        client.post('/v1/plants', json=plant_payload(), headers=ALICE)
        response = client.post('/v1/demo/sensors', headers=ALICE, json={
            'id': 'simulator-1', 'plantId': 'aloe-1', 'name': 'Demo device',
            'dry': 3000, 'wet': 1000, 'moisture': 15, 'observedAt': at(),
            'source': 'SENSOR', 'demo': True})
        assert response.status_code == 200, response.text
        twin = client.get('/v1/plants/aloe-1/twin', headers=ALICE).json()
        assert twin['measured'] is None
        assert twin['inferred']['status'] == 'unknown'
        assert twin['evidence_count'] == 0
        assert twin['demo_evidence_count'] == 1
        readings = client.get('/v1/plants/aloe-1/sensor-observations', headers=ALICE).json()
        assert readings[0]['demo'] is True
        assert all(e['type'] != 'LowSoilMoistureDetected' for e in client.get('/v1/plants/aloe-1/events', headers=ALICE).json())


@pytest.mark.parametrize('path', ['/v1/garden', '/v1/plants/aloe-1/twin', '/v1/plants/aloe-1/events'])
def test_missing_or_wrong_user_token_is_rejected(planted, path):
    assert planted.get(path).status_code in (401, 403)
    assert planted.get(path, headers={'Authorization': 'Bearer wrong'}).status_code == 401


@pytest.mark.parametrize('suffix', ['twin', 'events', 'user-observations', 'sensor-observations'])
def test_another_owner_cannot_read_plant_data(planted, suffix):
    assert planted.get(f'/v1/plants/aloe-1/{suffix}', headers=BOB).status_code == 404
    assert planted.get('/v1/garden', headers=BOB).json()['plants'] == []


def test_another_owner_cannot_modify_or_register_device_for_plant(planted, device):
    assert planted.post('/v1/plants/aloe-1/user-observations', json=user_payload(), headers=BOB).status_code == 404
    assert planted.post('/v1/devices', json={'plant_id': 'aloe-1', 'name': 'Mine'}, headers=BOB).status_code == 404
    assert planted.post(f'/v1/devices/{device["id"]}/calibrations', json={'dry': 3000, 'wet': 1000}, headers=BOB).status_code == 404
    assert planted.delete(f'/v1/devices/{device["id"]}', headers=BOB).status_code == 404


def test_device_credentials_are_scoped_and_revocable(planted, device):
    path = f'/v1/devices/{device["id"]}/readings'
    assert planted.post(path, json=reading_payload(), headers=ALICE).status_code == 401
    assert planted.get('/v1/garden', headers=device['headers']).status_code == 401
    other = planted.post('/v1/devices', json={'plant_id': 'aloe-1', 'name': 'Other ESP32'}, headers=ALICE).json()
    assert planted.post(path, json=reading_payload(), headers={'Authorization': f'Bearer {other["device_token"]}'}).status_code == 401
    with planted.app.state.factory() as db:
        stored = db.get(Device, device['id'])
        assert stored.token_hash != device['device_token']
    assert 'device_token' not in str(planted.get('/v1/garden', headers=ALICE).json())
    assert planted.delete(f'/v1/devices/{device["id"]}', headers=ALICE).status_code == 200
    assert ingest(planted, device, reading_payload()).status_code == 403


@pytest.mark.parametrize('changes', [
    {'raw_adc': -1}, {'raw_adc': 4096}, {'raw_adc': 12.5},
    {'signal_quality': -1}, {'signal_quality': 1.1}, {'calibration_version': 0},
    {'message_id': ''}, {'observed_at': '2026-01-01T10:00:00'},
    {'observed_at': 'not-a-date'}, {'observed_at': '2099-01-01T00:00:00Z'},
    {'soil': 'dry'}, {'normalized_percent': 75}])
def test_invalid_sensor_input_is_rejected_without_writing(planted, device, changes):
    response = ingest(planted, device, reading_payload(**changes))
    assert response.status_code == 422, response.text
    assert planted.get('/v1/plants/aloe-1/sensor-observations', headers=ALICE).json() == []


@pytest.mark.parametrize('changes', [
    {'type': 'unknown'}, {'amount_ml': -1}, {'amount_ml': 100001},
    {'soil': 'dry'}, {'observed_at': '2026-01-01T10:00:00'},
    {'observed_at': '2099-01-01T00:00:00Z'}, {'id': ''},
    {'source': 'SENSOR'}, {'raw_adc': 2000}])
def test_invalid_user_input_is_rejected_without_writing(planted, changes):
    response = planted.post('/v1/plants/aloe-1/user-observations', json=user_payload(**changes), headers=ALICE)
    assert response.status_code == 422, response.text
    assert planted.get('/v1/plants/aloe-1/user-observations', headers=ALICE).json() == []


@pytest.mark.parametrize('calibration', [{'dry': 1000, 'wet': 3000}, {'dry': 1000, 'wet': 1000}, {'dry': 4096, 'wet': 1000}, {'dry': 3000, 'wet': -1}])
def test_invalid_calibration_cannot_replace_valid_version(planted, device, calibration):
    response = planted.post(f'/v1/devices/{device["id"]}/calibrations', json=calibration, headers=ALICE)
    assert response.status_code == 422
    assert planted.get('/v1/garden', headers=ALICE).json()['sensors'][0]['calibrationVersion'] == 1


def test_demo_mutations_disabled_in_real_mode(planted):
    assert planted.post('/v1/demo/plan', json={'plan': 'Plus', 'annual': True}, headers=ALICE).status_code == 403
    assert planted.post('/v1/demo/sensors', json={}, headers=ALICE).status_code == 403


def test_persisted_evidence_rebuilds_same_twin_after_restart(database_url):
    with TestClient(create_app(database_url, demo=False, tokens=TOKENS)) as client:
        client.post('/v1/plants', json=plant_payload(), headers=ALICE)
        client.post('/v1/plants/aloe-1/user-observations', json=user_payload(type='Soil check', soil='dry'), headers=ALICE)
        first = client.get('/v1/plants/aloe-1/twin', headers=ALICE).json()
        with client.app.state.factory.begin() as db:
            row = db.get(TwinSnapshot, 'aloe-1')
            db.delete(row)
    with TestClient(create_app(database_url, demo=False, tokens=TOKENS)) as client:
        rebuilt = client.post('/v1/plants/aloe-1/twin/rebuild', headers=ALICE)
        assert rebuilt.status_code == 200
        second = rebuilt.json()
        assert second['reported'] == first['reported']
        assert second['inferred'] == first['inferred']
        assert second['evidence_count'] == 1
        assert second['engine_version'] == first['engine_version']
        assert len(client.get('/v1/plants/aloe-1/user-observations', headers=ALICE).json()) == 1
        with client.app.state.factory() as db:
            assert db.get(TwinSnapshot, 'aloe-1').state['reported'] == first['reported']


def test_plant_creation_is_idempotent_and_plan_limit_enforced(client):
    for i in range(3):
        response = client.post('/v1/plants', json=plant_payload(f'plant-{i}'), headers=ALICE)
        assert response.status_code == 201
    assert client.post('/v1/plants', json=plant_payload('plant-0'), headers=ALICE).status_code == 201
    assert client.post('/v1/plants', json={**plant_payload('plant-0'), 'name': 'Different'}, headers=ALICE).status_code == 409
    assert client.post('/v1/plants', json=plant_payload('plant-4'), headers=ALICE).status_code == 409
    assert len(client.get('/v1/garden', headers=ALICE).json()['plants']) == 3
