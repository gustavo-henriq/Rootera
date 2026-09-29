"""Plans, plant editing/archiving, change feedback and the optional integrations."""
from datetime import datetime, timezone

import base64
import httpx
from fastapi.testclient import TestClient

from app.db import UserObservation
from app.integrations import plantnet, revenuecat
from app.main import create_app
from conftest import ALICE, TOKENS, plant_payload


def now():
    return datetime.now(timezone.utc).isoformat()


def test_free_plan_limit_and_archive_frees_a_slot_without_losing_history(client):
    for i in range(3):
        assert client.post('/v1/plants', json=plant_payload(f'p{i}'), headers=ALICE).status_code == 201
    client.post('/v1/plants/p0/user-observations', json={'id': 'w', 'type': 'Watered', 'observed_at': now()}, headers=ALICE)
    assert client.post('/v1/plants', json=plant_payload('p3'), headers=ALICE).status_code == 409
    assert client.delete('/v1/plants/p0', headers=ALICE).json() == {'archived': True, 'reason': 'removed'}
    garden = client.get('/v1/garden', headers=ALICE).json()
    assert [p['id'] for p in garden['plants']] == ['p1', 'p2'] and garden['events'] == []
    with client.app.state.factory() as db:
        assert db.get(UserObservation, 'w') is not None
    assert client.post('/v1/plants', json=plant_payload('p3'), headers=ALICE).status_code == 201


def test_plus_plan_removes_the_limit_and_legacy_plans_map_to_plus(database_url):
    with TestClient(create_app(database_url, demo=True, tokens=TOKENS)) as c:
        assert c.post('/v1/demo/plan', json={'plan': 'Thrive', 'annual': True}, headers=ALICE).json()['plan'] == 'Plus'
        for i in range(5):
            assert c.post('/v1/plants', json=plant_payload(f'p{i}'), headers=ALICE).status_code == 201
        garden = c.get('/v1/garden', headers=ALICE).json()
        assert garden['plan'] == 'Plus' and garden['plan_capacity'] is None and garden['plan_source'] == 'demo'


def test_plant_context_can_be_edited_and_species_cannot(planted):
    r = planted.patch('/v1/plants/aloe-1', json={'drainage': 'No', 'light': 'Direct sun'}, headers=ALICE)
    assert r.status_code == 200 and r.json()['drainage'] == 'No' and r.json()['kind'] == 'aloe'
    assert planted.patch('/v1/plants/aloe-1', json={'kind': 'cactus'}, headers=ALICE).status_code == 422


def test_saving_care_reports_what_changed(planted):
    r = planted.post('/v1/plants/aloe-1/user-observations', json={'id': 's', 'type': 'Soil check', 'soil': 'dry', 'observed_at': now()}, headers=ALICE).json()
    assert r['change'] == {'from': 'Start with a soil check', 'to': 'You found the soil dry'}
    again = planted.post('/v1/plants/aloe-1/user-observations', json={'id': 's', 'type': 'Soil check', 'soil': 'dry', 'observed_at': r['twin']['guidance']['last_soil_check_at']}, headers=ALICE)
    assert again.status_code == 201 and again.json()['duplicate'] is True


def test_soil_check_requires_a_condition(planted):
    r = planted.post('/v1/plants/aloe-1/user-observations', json={'id': 's', 'type': 'Soil check', 'observed_at': now()}, headers=ALICE)
    assert r.status_code == 422


def test_twin_lists_sources_separately(planted):
    twin = planted.get('/v1/garden', headers=ALICE).json()['twins']['aloe-1']
    assert twin['sources']['sensor'] == {'connected': False, 'readings': 0}
    assert twin['sources']['external'] == {'weather': False, 'identification': False}
    assert twin['guidance']['reference']['summary']


def test_integrations_answer_plainly_without_credentials(planted):
    assert planted.post('/v1/billing/sync', headers=ALICE).status_code == 503
    assert planted.post('/v1/identify', json={'image_base64': 'a' * 200}, headers=ALICE).status_code == 503
    assert planted.post('/v1/billing/webhook', json={'event': {'app_user_id': 'alice'}}).status_code == 401
    health = planted.get('/health').json()
    assert health['integrations'] == {'billing': False, 'identification': False, 'weather': False, 'demo': False}


def test_revenuecat_entitlement_is_read_on_the_server():
    def handler(request):
        assert request.headers['Authorization'] == 'Bearer sk_test'
        return httpx.Response(200, json={'subscriber': {'entitlements': {'plus': {'expires_date': '2999-01-01T00:00:00Z', 'product_identifier': 'rootera_plus_annual'}}}})
    ent = revenuecat.active_entitlement('alice', 'sk_test', 'plus', httpx.Client(transport=httpx.MockTransport(handler)))
    assert ent['active'] and ent['annual']
    expired = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json={'subscriber': {'entitlements': {'plus': {'expires_date': '2020-01-01T00:00:00Z'}}}})))
    assert not revenuecat.active_entitlement('alice', 'sk_test', 'plus', expired)['active']


def test_billing_sync_stores_plan(database_url, monkeypatch):
    monkeypatch.setattr(revenuecat, 'active_entitlement', lambda *a, **k: {'active': True, 'annual': False})
    with TestClient(create_app(database_url, demo=False, tokens=TOKENS, revenuecat_secret_key='sk_test')) as c:
        assert c.post('/v1/billing/sync', headers=ALICE).json() == {'plan': 'Plus', 'annual': False, 'source': 'revenuecat'}
        assert c.get('/v1/garden', headers=ALICE).json()['plan'] == 'Plus'


def test_plantnet_results_map_to_known_species():
    body = {'results': [{'score': .81, 'species': {'scientificNameWithoutAuthor': 'Epipremnum aureum', 'commonNames': ['Golden pothos'], 'family': {'scientificNameWithoutAuthor': 'Araceae'}}},
                        {'score': .05, 'species': {'scientificNameWithoutAuthor': 'Echinopsis sp', 'commonNames': [], 'family': {'scientificNameWithoutAuthor': 'Cactaceae'}}}]}
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=body)))
    results = plantnet.identify(base64.b64encode(b'jpeg' * 60).decode(), 'auto', 'key', client)
    assert [r['kind'] for r in results] == ['pothos', 'cactus'] and results[0]['common_name'] == 'Golden pothos'


def test_nudge_preferences_are_validated_and_saved(client):
    assert client.get('/v1/garden', headers=ALICE).json()['nudges'] == {'kinds': ['soil_check'], 'time': '08:00'}
    body = {'nudges': {'kinds': ['soil_check', 'weekly', 'soil_check'], 'time': '07:30'}}
    assert client.patch('/v1/profile', json=body, headers=ALICE).status_code == 200
    assert client.get('/v1/garden', headers=ALICE).json()['nudges'] == {'kinds': ['soil_check', 'weekly'], 'time': '07:30'}
    assert client.patch('/v1/profile', json={'nudges': {'time': '25:00'}}, headers=ALICE).status_code == 422
    assert client.patch('/v1/profile', json={'nudges': {'kinds': ['spam']}}, headers=ALICE).status_code == 422


def test_new_species_have_reference_notes_and_map_from_plantnet():
    from app.integrations.plantnet import kind_for
    from app.species import SPECIES_NOTES
    for kind in ('gerbera', 'sunflower', 'orchid', 'fern', 'echeveria', 'rubber-plant', 'calathea', 'basil'):
        notes = SPECIES_NOTES[kind]
        assert notes['dryness'] in ('top', 'half', 'full') and notes['check_tip'] and notes['summary']
    assert kind_for('Phalaenopsis amabilis') == 'orchid'
    assert kind_for('Goeppertia orbifolia') == 'calathea'
    assert kind_for('Helianthus annuus') == 'sunflower'


def test_product_events_are_recorded_and_validated(client):
    from tests.conftest import ALICE
    ok = client.post('/v1/events', json={'events': [{'name': 'onboarding_step_viewed', 'at': '2026-09-25T10:00:00Z', 'props': {'step': 'story'}}]}, headers=ALICE)
    assert ok.status_code == 202 and ok.json() == {'accepted': 1}
    bad = client.post('/v1/events', json={'events': [{'name': 'Has Spaces', 'at': 'x', 'props': {}}]}, headers=ALICE)
    assert bad.status_code == 422
    nested = client.post('/v1/events', json={'events': [{'name': 'x_y', 'at': 'x', 'props': {'a': {'b': 1}}}]}, headers=ALICE)
    assert nested.status_code == 422
    assert client.get('/v1/events/funnel', headers=ALICE).status_code == 403  # demo only


def test_yearly_and_lifetime_products_are_read_right():
    def entitlement(product, expires):
        def handler(request):
            return httpx.Response(200, json={'subscriber': {'entitlements': {'rootera': {'product_identifier': product, 'expires_date': expires}}}})
        return revenuecat.active_entitlement('alice', 'sk_test', 'rootera', httpx.Client(transport=httpx.MockTransport(handler)))
    later = '2099-01-01T00:00:00Z'
    assert entitlement('yearly', later) == {'active': True, 'annual': True, 'lifetime': False, 'product': 'yearly', 'expires_at': later}
    assert entitlement('monthly', later)['annual'] is False
    life = entitlement('lifetime', None)
    assert life['active'] and life['lifetime'] and not life['annual']
