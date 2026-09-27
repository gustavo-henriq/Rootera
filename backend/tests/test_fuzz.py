"""Randomized histories: the guidance and the drying window must never crash, contradict
themselves or leak an untranslated / unformatted text, whatever the caregiver records."""
import random
import re
from datetime import timedelta

import pytest

from app.domain import Evidence, PlantTwinEngine
from app.guidance import SensorlessGuidance
from app.i18n import PT
from app.species import SPECIES_NOTES
from test_guidance import NOW

KINDS = list(SPECIES_NOTES) + ['other', None, 'unknown-kind']
ACTIONS = {'check_soil', 'log_water', 'observe', 'wait'}
BASIS = {'Species reference', 'Your appearance check', 'Your watering record', 'Your watering records', 'Your soil check',
         'Your soil checks', 'Your care history', 'Pot details you added'}
CONTEXT = {
    'pot': ['Small pot', 'Medium pot', 'Large pot', 'Not sure'], 'material': ['Terracotta', 'Plastic', 'Ceramic', 'Not sure'],
    'drainage': ['Yes', 'No', 'Not sure'], 'self_watering': ['Yes', 'No', 'Not sure'],
    'substrate': ['Regular potting mix', 'Very draining / chunky', 'Dense / holds water', "I don't know"],
    'light': ['Low light', 'Indirect light', 'Bright indirect light', 'Direct sun', 'Not sure'],
}


def random_plant(rng):
    plant = {k: rng.choice(v) for k, v in CONTEXT.items() if rng.random() < .7}
    plant['kind'] = rng.choice(KINDS)
    if rng.random() < .5:
        plant['environment'] = {'location': rng.choice(['Indoors', 'Outdoors', 'Balcony / patio', 'Not sure'])}
    return plant


def random_history(rng):
    events, n = [], rng.randint(0, 40)
    for i in range(n):
        # Mostly the past 90 days, sometimes a few minutes in the future (phone clock ahead),
        # sometimes identical timestamps.
        hours = rng.choice([rng.uniform(0, 24 * 90), rng.uniform(-0.08, 0), 0, 48])
        at = (NOW - timedelta(hours=hours)).isoformat()
        kind = rng.choice(['Watered', 'Soil check', 'Observation', 'Fertilized'])
        value = {'note': ''}
        if kind == 'Soil check':
            value['soil'] = rng.choice(['dry', 'slightly_moist', 'moist', 'wet', 'not_sure'])
        if kind == 'Observation' and rng.random() < .8:
            value['visual'] = rng.choice(['great', 'different', 'unwell', 'not_sure'])
        if kind == 'Watered' and rng.random() < .5:
            value['amount_ml'] = rng.choice([None, 100, 250])
        events.append(Evidence(f'e{i}', 'USER', kind, value, at, .65))
    if rng.random() < .2:
        events.append(Evidence('s', 'SENSOR', 'SoilMoistureMeasured', {'moisture': rng.uniform(0, 100)}, NOW.isoformat(), .9))
    return events


def unformatted(text):
    return text and re.search(r'\{\w+\}', text)


@pytest.mark.parametrize('seed', range(40))
def test_random_histories_hold_the_invariants(seed):
    rng = random.Random(seed)
    for _ in range(50):
        plant, events = random_plant(rng), random_history(rng)
        caregiver = {'detail': rng.choice(['Guided', 'Concise'])}
        en = SensorlessGuidance().project(plant, caregiver, events, NOW)
        pt = SensorlessGuidance().project(plant, caregiver, events, NOW, lang='pt')
        PlantTwinEngine().project('p', events, NOW)
        # The language changes words only.
        assert (en['action'], en['basis'], en['state'], en['forecast']) == (pt['action'], pt['basis'], pt['state'], pt['forecast'])
        assert en['action'] in ACTIONS and set(en['basis']) <= BASIS and en['basis']
        assert en['title'] in PT, en['title']
        for g in (en, pt):
            for field in ('title', 'reason', 'tip', 'learning', 'baseline_note'):
                assert not unformatted(g[field]), (field, g[field])
            assert '%' not in g['reason']
        if caregiver['detail'] == 'Concise':
            assert en['tip'] is None
        f = en['forecast']
        if f:
            assert 1 <= f['low_days'] <= f['high_days'] <= 120, f
            assert f['source'] in ('cycles', 'blend', 'estimate')
            assert (f['check_from'] is None) == (en['last_watered_at'] is None)
            assert plant.get('self_watering') != 'Yes'
        if en['baseline_days'] is not None:
            assert en['completed_cycles'] >= 3 and en['state'] == 'PATTERN'
