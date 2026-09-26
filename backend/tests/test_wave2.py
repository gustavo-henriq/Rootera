"""Scale and undo: the garden stays cheap with many plants, and a care record can be taken back."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import event

from app import service as service_module
from conftest import ALICE, plant_payload

NOW = datetime.now(timezone.utc)


def soil(id, hours_ago, soil='dry'):
    return {'id': id, 'type': 'Soil check', 'soil': soil, 'observed_at': (NOW - timedelta(hours=hours_ago)).isoformat()}


def test_undo_removes_the_record_and_updates_the_twin(planted):
    assert planted.post('/v1/plants/aloe-1/user-observations', json=soil('s1', 2), headers=ALICE).status_code == 201
    before = planted.get('/v1/garden', headers=ALICE).json()['twins']['aloe-1']['guidance']
    assert before['soil'] == 'dry'
    undo = planted.delete('/v1/plants/aloe-1/user-observations/s1', headers=ALICE)
    assert undo.status_code == 200 and undo.json()['removed'] is True
    after = planted.get('/v1/garden', headers=ALICE).json()
    assert after['events'] == [] and after['twins']['aloe-1']['guidance']['soil'] is None
    # the domain log keeps the retraction
    log = planted.get('/v1/plants/aloe-1/events', headers=ALICE).json()
    assert [e['type'] for e in log][-1] == 'UserObservationRetracted'


def test_undo_is_scoped_to_the_owner_and_plant(planted):
    planted.post('/v1/plants/aloe-1/user-observations', json=soil('s1', 2), headers=ALICE)
    assert planted.delete('/v1/plants/aloe-1/user-observations/nope', headers=ALICE).status_code == 404
    bob = {'Authorization': 'Bearer bob-token'}
    assert planted.delete('/v1/plants/aloe-1/user-observations/s1', headers=bob).status_code == 404


def test_snapshot_keeps_a_window_and_the_journal_pages_the_rest(planted, monkeypatch):
    monkeypatch.setattr(service_module, 'EVENT_WINDOW', 5)
    for i in range(12):
        planted.post('/v1/plants/aloe-1/user-observations', json=soil(f's{i}', 12 - i), headers=ALICE)
    g = planted.get('/v1/garden', headers=ALICE).json()
    assert len(g['events']) == 5 and g['events_complete'] is False
    assert g['events'][-1]['id'] == 's11'  # the newest records are the ones kept
    page = planted.get('/v1/journal', params={'before': g['events'][0]['at'], 'limit': 4}, headers=ALICE).json()
    assert [e['id'] for e in page['events']] == ['s6', 's5', 's4', 's3'] and page['more'] is True
    last = planted.get('/v1/journal', params={'before': page['events'][-1]['at'], 'limit': 4}, headers=ALICE).json()
    assert [e['id'] for e in last['events']] == ['s2', 's1', 's0'] and last['more'] is False


def test_garden_snapshot_query_count_does_not_grow_per_plant(client):
    for i in range(40):
        client.post('/v1/plants', json=plant_payload(f'p{i}'), headers=ALICE)
        client.post(f'/v1/plants/p{i}/user-observations', json=soil(f'o{i}', i + 1), headers=ALICE)
    engine = client.app.state.factory.kw['bind']
    count = {'n': 0}
    listener = lambda *a, **k: count.__setitem__('n', count['n'] + 1)
    event.listen(engine, 'before_cursor_execute', listener)
    try:
        assert client.get('/v1/garden', headers=ALICE).status_code == 200
    finally:
        event.remove(engine, 'before_cursor_execute', listener)
    assert count['n'] < 15, count['n']
