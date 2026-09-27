"""Guidance in the app's language: Portuguese on request, English otherwise and when stored."""
import re
from datetime import datetime, timezone

from app.i18n import PT, SPECIES_PT, lang_from, tr
from app.species import SPECIES_NOTES
from conftest import ALICE

PT_HEADERS = {**ALICE, 'Accept-Language': 'pt-BR,pt;q=0.9'}


def soil(value, id='s1'):
    return {'id': id, 'type': 'Soil check', 'note': '', 'observed_at': datetime.now(timezone.utc).isoformat(), 'soil': value}


def test_language_header():
    assert lang_from('pt-BR,pt;q=0.9') == 'pt'
    assert lang_from('pt') == 'pt'
    assert lang_from('en-US') == 'en'
    assert lang_from(None) == 'en'


def test_every_translation_keeps_its_placeholders():
    for en, pt in PT.items():
        assert set(re.findall(r'\{(\w+)\}', en)) == set(re.findall(r'\{(\w+)\}', pt)), en


def test_every_species_has_portuguese_notes():
    for kind, notes in SPECIES_NOTES.items():
        assert kind in SPECIES_PT, kind
        assert set(SPECIES_PT[kind]) == set(notes) - {'dryness'}, kind


def test_garden_in_portuguese_when_asked(planted):
    g = planted.get('/v1/garden', headers=PT_HEADERS).json()['twins']['aloe-1']['guidance']
    assert g['title'] == 'Comece checando a terra'
    assert g['reference']['summary'] == SPECIES_PT['aloe']['summary']
    # Decisions do not depend on the language; the app translates the basis itself.
    assert g['action'] == 'check_soil'
    assert g['basis'] == ['Species reference']


def test_garden_stays_english_by_default(planted):
    g = planted.get('/v1/garden', headers=ALICE).json()['twins']['aloe-1']['guidance']
    assert g['title'] == 'Start with a soil check'


def test_change_report_stays_english(planted):
    """The app compares the reported change with known states, so it is never translated."""
    r = planted.post('/v1/plants/aloe-1/user-observations', json=soil('dry'), headers=PT_HEADERS).json()
    assert r['change'] == {'from': 'Start with a soil check', 'to': 'You found the soil dry'}
    g = planted.get('/v1/garden', headers=PT_HEADERS).json()['twins']['aloe-1']['guidance']
    assert g['title'] == tr('You found the soil dry', 'pt')
    assert g['reason'] == SPECIES_PT['aloe']['when_dry']


def test_errors_follow_the_app_language(planted):
    missing = planted.patch('/v1/plants/nope', json={'name': 'x'}, headers=PT_HEADERS)
    assert missing.status_code == 404 and missing.json()['detail'] == 'Planta não encontrada.'
    assert planted.patch('/v1/plants/nope', json={'name': 'x'}, headers=ALICE).json()['detail'] == 'Plant not found'
    # The app recognises the plan limit by the word "limit" in either language.
    assert 'Limite' in tr('Plant limit reached for your plan.', 'pt')
