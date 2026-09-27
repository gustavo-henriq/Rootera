from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app


TOKENS = {'alice-token': 'alice', 'bob-token': 'bob'}
ALICE = {'Authorization': 'Bearer alice-token'}
BOB = {'Authorization': 'Bearer bob-token'}


@pytest.fixture
def database_url(tmp_path):
    return f'sqlite:///{(tmp_path / "garden.db").as_posix()}'


@pytest.fixture
def client(database_url):
    with TestClient(create_app(database_url, demo=False, tokens=TOKENS, seed_example=False)) as client:
        yield client


def plant_payload(plant_id='aloe-1'):
    return {'id': plant_id, 'name': 'Kitchen aloe', 'species': 'Aloe vera',
            'kind': 'aloe', 'room': 'Kitchen', 'pot': 'Medium pot',
            'light': 'Bright indirect light'}


@pytest.fixture
def planted(client):
    response = client.post('/v1/plants', json=plant_payload(), headers=ALICE)
    assert response.status_code == 201, response.text
    return client


@pytest.fixture
def device(planted):
    response = planted.post('/v1/devices', json={'plant_id': 'aloe-1', 'name': 'ESP32 kitchen'}, headers=ALICE)
    assert response.status_code == 201, response.text
    device = response.json()
    response = planted.post(f'/v1/devices/{device["id"]}/calibrations', json={'dry': 3000, 'wet': 1000}, headers=ALICE)
    assert response.status_code == 201, response.text
    device['calibration'] = response.json()
    device['headers'] = {'Authorization': f'Bearer {device["device_token"]}'}
    return device
