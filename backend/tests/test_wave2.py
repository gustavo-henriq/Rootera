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


def test_the_journal_neither_skips_nor_repeats_records_that_share_a_time(planted):
    same = (NOW - timedelta(hours=5)).isoformat()
    for i in range(6):
        body = {'id': f't{i}', 'type': 'Soil check', 'soil': 'moist', 'observed_at': same}
        assert planted.post('/v1/plants/aloe-1/user-observations', json=body, headers=ALICE).status_code == 201
    seen, cursor = [], {}
    while True:
        page = planted.get('/v1/journal', params={'limit': 4, **cursor}, headers=ALICE).json()
        seen += [e['id'] for e in page['events']]
        if not page['more']:
            break
        cursor = {'before': page['events'][-1]['at'], 'before_id': page['events'][-1]['id']}
    assert sorted(seen) == [f't{i}' for i in range(6)] and len(seen) == 6


def test_the_journal_leaves_out_plants_that_left_before_the_limit(client):
    for pid in ('kept', 'gone'):
        client.post('/v1/plants', json=plant_payload(pid), headers=ALICE)
    for i in range(5):
        client.post('/v1/plants/gone/user-observations', json=soil(f'g{i}', 1 + i), headers=ALICE)
    client.post('/v1/plants/kept/user-observations', json=soil('k', 10), headers=ALICE)
    assert client.delete('/v1/plants/gone', headers=ALICE).status_code == 200
    page = client.get('/v1/journal', params={'limit': 1}, headers=ALICE).json()
    # The newest records belong to the plant that left; the page still shows the kept one.
    assert [e['id'] for e in page['events']] == ['k'] and page['more'] is False


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


def test_a_deleted_record_can_be_restored_with_the_same_id(planted):
    body = soil('s1', 2)
    planted.post('/v1/plants/aloe-1/user-observations', json=body, headers=ALICE)
    planted.delete('/v1/plants/aloe-1/user-observations/s1', headers=ALICE)
    again = planted.post('/v1/plants/aloe-1/user-observations', json=body, headers=ALICE)
    assert again.status_code == 201 and again.json()['duplicate'] is False
    g = planted.get('/v1/garden', headers=ALICE).json()
    assert [e['id'] for e in g['events']] == ['s1']
    types = [e['type'] for e in planted.get('/v1/plants/aloe-1/events', headers=ALICE).json()]
    assert types.count('SoilConditionReported') == 2 and 'UserObservationRetracted' in types
