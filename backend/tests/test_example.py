"""The example plant: added once, labelled, outside the plan limit, removable for good."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from conftest import ALICE, TOKENS, plant_payload

PT = {**ALICE, 'Accept-Language': 'pt-BR'}


@pytest.fixture
def seeded(database_url):
    with TestClient(create_app(database_url, demo=False, tokens=TOKENS, seed_example=True)) as client:
        yield client


def example(garden):
    return [p for p in garden['plants'] if p.get('example')]


def test_added_once_with_a_ready_pattern(seeded):
    garden = seeded.get('/v1/garden', headers=PT).json()
    [plant] = example(garden)
    assert plant['name'] == 'Costela-de-adão' and plant['kind'] == 'monstera'
    g = garden['twins'][plant['id']]['guidance']
    assert g['state'] == 'PATTERN' and g['completed_cycles'] == 3
    assert g['action'] == 'wait' and g['title'] == 'Provavelmente ainda não secou'
    assert g['forecast']['source'] == 'cycles' and (g['forecast']['low_days'], g['forecast']['high_days']) == (4, 5)
    assert len([e for e in garden['events'] if e['plantId'] == plant['id']]) == 14
    # A second read does not add another one.
    assert len(example(seeded.get('/v1/garden', headers=ALICE).json())) == 1


def test_does_not_take_a_plan_spot(seeded):
    seeded.get('/v1/garden', headers=ALICE)
    for i in range(3):
        assert seeded.post('/v1/plants', json=plant_payload(f'p{i}'), headers=ALICE).status_code == 201
    garden = seeded.get('/v1/garden', headers=ALICE).json()
    assert len(garden['plants']) == 4 and garden['plan_used'] == 3 and garden['plan_capacity'] == 3
    assert seeded.post('/v1/plants', json=plant_payload('p3'), headers=ALICE).status_code == 409


def test_removed_for_good_and_checkable_like_any_plant(seeded):
    [plant] = example(seeded.get('/v1/garden', headers=ALICE).json())
    r = seeded.post(f"/v1/plants/{plant['id']}/user-observations", headers=ALICE,
                    json={'id': 'mine', 'type': 'Soil check', 'note': '', 'observed_at': datetime.now(timezone.utc).isoformat(), 'soil': 'moist'})
    assert r.status_code == 201 and r.json()['change']['to'] == 'Still moist'
    assert seeded.delete(f"/v1/plants/{plant['id']}", headers=ALICE).status_code == 200
    assert example(seeded.get('/v1/garden', headers=ALICE).json()) == []


def test_each_account_gets_its_own(seeded):
    a = example(seeded.get('/v1/garden', headers=ALICE).json())[0]['id']
    b = example(seeded.get('/v1/garden', headers={'Authorization': 'Bearer bob-token'}).json())[0]['id']
    assert a != b
