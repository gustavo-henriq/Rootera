"""API integration tests use isolated, real SQLite databases and app lifespans."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import TwinSnapshot
from app.main import create_app
from conftest import ALICE, BOB, TOKENS, plant_payload


def at(hours=0):
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()


def user_payload(id='care-1', type='Watered', **changes):
    return {'id': id, 'type': type, 'observed_at': at(), **changes}


def test_user_care_is_kept_as_given(planted):
    care = planted.post('/v1/plants/aloe-1/user-observations', json=user_payload(amount_ml=200), headers=ALICE)
    assert care.status_code == 201
    user = planted.get('/v1/plants/aloe-1/user-observations', headers=ALICE).json()
    assert len(user) == 1 and user[0]['source'] == 'USER'
    assert user[0]['value']['amount_ml'] == 200
    assert 'normalized_percent' not in user[0]
    garden = planted.get('/v1/garden', headers=ALICE).json()
    assert garden['events'][0]['source'] == 'USER'
    assert 'sensors' not in garden


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


@pytest.mark.parametrize('path', ['/v1/garden', '/v1/plants/aloe-1/twin', '/v1/plants/aloe-1/events'])
def test_missing_or_wrong_user_token_is_rejected(planted, path):
    assert planted.get(path).status_code in (401, 403)
    assert planted.get(path, headers={'Authorization': 'Bearer wrong'}).status_code == 401


@pytest.mark.parametrize('suffix', ['twin', 'events', 'user-observations'])
def test_another_owner_cannot_read_plant_data(planted, suffix):
    assert planted.get(f'/v1/plants/aloe-1/{suffix}', headers=BOB).status_code == 404
    assert planted.get('/v1/garden', headers=BOB).json()['plants'] == []


def test_another_owner_cannot_add_care_to_a_plant(planted):
    assert planted.post('/v1/plants/aloe-1/user-observations', json=user_payload(), headers=BOB).status_code == 404


@pytest.mark.parametrize('changes', [
    {'type': 'unknown'}, {'amount_ml': -1}, {'amount_ml': 100001},
    {'soil': 'dry'}, {'observed_at': '2026-01-01T10:00:00'},
    {'observed_at': '2099-01-01T00:00:00Z'}, {'id': ''},
    {'source': 'SENSOR'}, {'raw_adc': 2000}])
def test_invalid_user_input_is_rejected_without_writing(planted, changes):
    response = planted.post('/v1/plants/aloe-1/user-observations', json=user_payload(**changes), headers=ALICE)
    assert response.status_code == 422, response.text
    assert planted.get('/v1/plants/aloe-1/user-observations', headers=ALICE).json() == []


def test_demo_mutations_disabled_in_real_mode(planted):
    assert planted.post('/v1/demo/plan', json={'plan': 'Plus', 'annual': True}, headers=ALICE).status_code == 403


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
        for key in ('soil', 'action', 'title'):
            assert second['guidance'][key] == first['guidance'][key]
        assert second['evidence_count'] == 1
        assert second['engine_version'] == first['engine_version']
        assert len(client.get('/v1/plants/aloe-1/user-observations', headers=ALICE).json()) == 1
        with client.app.state.factory() as db:
            assert db.get(TwinSnapshot, 'aloe-1').state['guidance']['soil'] == first['guidance']['soil'] == 'dry'


def test_plant_creation_is_idempotent_and_plan_limit_enforced(client):
    for i in range(3):
        response = client.post('/v1/plants', json=plant_payload(f'plant-{i}'), headers=ALICE)
        assert response.status_code == 201
    assert client.post('/v1/plants', json=plant_payload('plant-0'), headers=ALICE).status_code == 201
    assert client.post('/v1/plants', json={**plant_payload('plant-0'), 'name': 'Different'}, headers=ALICE).status_code == 409
    assert client.post('/v1/plants', json=plant_payload('plant-4'), headers=ALICE).status_code == 409
    assert len(client.get('/v1/garden', headers=ALICE).json()['plants']) == 3
