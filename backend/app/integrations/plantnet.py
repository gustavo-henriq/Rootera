"""Pl@ntNet species identification, proxied by the backend so the API key stays secret.

Results are candidate species for the caregiver to confirm. They are never saved
as facts about the plant without that confirmation.
"""
import base64
import binascii
import httpx

API = 'https://my-api.plantnet.org/v2/identify/all'
KINDS = [
    ('Aloe', 'aloe'), ('Spathiphyllum', 'peace-lily'), ('Monstera', 'monstera'), ('Epipremnum', 'pothos'),
    ('Sansevieria', 'snake-plant'), ('Dracaena trifasciata', 'snake-plant'), ('Zamioculcas', 'zz'), ('Pilea peperomioides', 'pilea'),
]


class IdentificationUnavailable(Exception):
    pass


def kind_for(scientific: str, family: str = '') -> str:
    for prefix, kind in KINDS:
        if scientific.startswith(prefix):
            return kind
    return 'cactus' if family == 'Cactaceae' else 'other'


def identify(image_base64: str, organ: str, api_key: str, client: httpx.Client | None = None) -> list[dict]:
    if not api_key:
        raise IdentificationUnavailable('Photo identification is not connected yet.')
    try:
        image = base64.b64decode(image_base64.split(',')[-1], validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError('The photo could not be read.') from error
    own = client is None
    client = client or httpx.Client(timeout=20)
    try:
        response = client.post(API, params={'api-key': api_key, 'nb-results': 3, 'lang': 'en'},
                               files={'images': ('plant.jpg', image, 'image/jpeg')}, data={'organs': organ})
    except httpx.HTTPError as error:
        raise IdentificationUnavailable('Could not reach Pl@ntNet.') from error
    finally:
        if own:
            client.close()
    if response.status_code == 404:
        return []
    if response.status_code != 200:
        raise IdentificationUnavailable(f'Pl@ntNet returned {response.status_code}.')
    results = []
    for r in response.json().get('results', [])[:3]:
        sp = r.get('species', {})
        scientific = sp.get('scientificNameWithoutAuthor', '')
        family = (sp.get('family') or {}).get('scientificNameWithoutAuthor', '')
        results.append({'scientific_name': scientific, 'common_name': (sp.get('commonNames') or [scientific])[0],
                        'family': family, 'kind': kind_for(scientific, family), 'score': round(float(r.get('score', 0)), 3)})
    return results
