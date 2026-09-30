"""One caregiver can never read or change another's garden, whatever route or id they try."""
import base64
from datetime import datetime, timezone

import httpx

from app.integrations import plantnet
from conftest import ALICE, BOB


def now():
    return datetime.now(timezone.utc).isoformat()


def test_every_plant_route_is_closed_to_other_owners(planted):
    care = {'id': 'a-care', 'type': 'Watered', 'note': '', 'observed_at': now()}
    assert planted.post('/v1/plants/aloe-1/user-observations', json=care, headers=ALICE).status_code == 201
    for method, path, body in [
        ('get', '/v1/plants/aloe-1/twin', None), ('post', '/v1/plants/aloe-1/twin/rebuild', None),
        ('get', '/v1/plants/aloe-1/events', None), ('get', '/v1/plants/aloe-1/user-observations', None),
        ('patch', '/v1/plants/aloe-1', {'name': 'Mine now'}),
        ('delete', '/v1/plants/aloe-1', None), ('delete', '/v1/plants/aloe-1/user-observations/a-care', None),
        ('post', '/v1/plants/aloe-1/user-observations', {'id': 'b-care', 'type': 'Watered', 'note': '', 'observed_at': now()}),
    ]:
        r = getattr(planted, method)(path, headers=BOB, **({'json': body} if body is not None else {}))
        assert r.status_code == 404, (method, path, r.status_code)
    # Reusing Alice's record id from Bob's account is refused too, and leaks nothing.
    bob_plant = {'id': 'bob-1', 'name': 'Bob', 'species': 'Aloe vera', 'kind': 'aloe'}
    assert planted.post('/v1/plants', json=bob_plant, headers=BOB).status_code == 201
    r = planted.post('/v1/plants/bob-1/user-observations', json=care, headers=BOB)
    assert r.status_code == 409 and 'aloe-1' not in r.text
    # Her records never show up in his journal, even when he asks for her plant.
    assert planted.get('/v1/journal?plant=aloe-1', headers=BOB).json()['events'] == []
    assert planted.get('/v1/plants/aloe-1/user-observations', headers=ALICE).status_code == 200


def test_plant_ids_cannot_be_taken_over(planted):
    same_id = {'id': 'aloe-1', 'name': 'Bob aloe', 'species': 'Aloe vera', 'kind': 'aloe'}
    assert planted.post('/v1/plants', json=same_id, headers=BOB).status_code == 409
    assert planted.get('/v1/garden', headers=ALICE).json()['plants'][0]['name'] == 'Kitchen aloe'


def test_no_token_or_a_wrong_one_gets_nothing(client):
    assert client.get('/v1/garden').status_code in (401, 403)
    assert client.get('/v1/garden', headers={'Authorization': 'Bearer nope'}).status_code == 401


def test_plantnet_answers_in_the_app_language():
    seen = {}

    def handler(request):
        seen['lang'] = request.url.params['lang']
        return httpx.Response(200, json={'results': []})
    client = httpx.Client(transport=httpx.MockTransport(handler))
    plantnet.identify(base64.b64encode(b'jpeg' * 60).decode(), 'auto', 'key', client, lang='pt')
    assert seen['lang'] == 'pt'


def test_a_plant_leaves_with_its_reason(planted):
    r = planted.delete('/v1/plants/aloe-1?reason=died', headers=ALICE)
    assert r.status_code == 200 and r.json() == {'archived': True, 'reason': 'died'}
    assert planted.get('/v1/garden', headers=ALICE).json()['plants'] == []
    assert planted.delete('/v1/plants/aloe-1?reason=eaten', headers=ALICE).status_code == 422
