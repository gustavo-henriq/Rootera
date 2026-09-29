"""A plant shown in the plain pot gets its species' illustration when a version knows it."""
from conftest import ALICE


def test_a_known_species_leaves_the_plain_pot_and_is_announced_once(client):
    # Added by name before its species had an illustration: kind 'other', the real latin name kept.
    body = {'id': 'm1', 'name': 'Minha costela', 'species': 'Monstera deliciosa', 'kind': 'other'}
    assert client.post('/v1/plants', json=body, headers=ALICE).status_code == 201
    garden = client.get('/v1/garden', headers=ALICE).json()
    plant = garden['plants'][0]
    assert plant['kind'] == 'monstera' and plant['art_new'] is True
    # The species notes come with it.
    assert garden['twins']['m1']['guidance']['reference']['dryness'] == 'half'
    # Seen: the announcement is not repeated.
    assert client.patch('/v1/plants/m1', json={'art_seen': True}, headers=ALICE).status_code == 200
    assert 'art_new' not in client.get('/v1/garden', headers=ALICE).json()['plants'][0]


def test_an_unknown_species_stays_in_the_plain_pot(client):
    body = {'id': 'x1', 'name': 'Mystery', 'species': 'Unknown species', 'kind': 'other'}
    client.post('/v1/plants', json=body, headers=ALICE)
    plant = client.get('/v1/garden', headers=ALICE).json()['plants'][0]
    assert plant['kind'] == 'other' and 'art_new' not in plant
    assert client.patch('/v1/plants/x1', json={'art_seen': False}, headers=ALICE).status_code == 422
