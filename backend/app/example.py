"""The example plant: one monstera with three finished watering cycles, so a new account
can see the Plant Twin, the drying window and a pattern at work before its own plants
have any history.

It is honest about what it is: the plant carries `example: true` (the app labels it
"Example" everywhere it shows), it does not take one of the free plan's spots, and the
caregiver can check in on it or remove it like any plant. It is added once per account,
dated relative to the moment it is added, and never comes back after being removed.
"""
from datetime import timedelta

from .db import DomainEvent, Plant, UserObservation
from .domain import utcnow
from .soil import summarize

# During Shipaton the example plant is the MVP: the same name in every language. The names
# it had before are renamed once (a name the caregiver chose is left alone).
NAME = 'MVP Shipaton'
OLD_NAMES = ('Monstera', 'Costela-de-adão')
NAMES = {'en': NAME, 'pt': NAME}
EVENT_TYPES = {'Watered': 'PlantWatered', 'Soil check': 'SoilConditionReported', 'Observation': 'PlantObserved'}

# (days before now, kind, value). Three cycles: dry about 8.5, 9.5 and 8.5 days after
# watering, like the Shipaton lab's MVP Shipaton, with checks in between as a caregiver
# would do; the last watering was 3 days ago.
# Checks are in three layers, drying from the top down (a monstera is dry when the
# surface and the middle are).
MOIST = {'top': 'moist', 'middle': 'moist', 'bottom': 'moist'}
DRYING = {'top': 'dry', 'middle': 'moist', 'bottom': 'moist'}
DRY = {'top': 'dry', 'middle': 'dry', 'bottom': 'moist'}
HISTORY = [
    (30.5, 'Watered', {'amount_ml': 400}),
    (27, 'Soil check', {'layers': MOIST}),
    (22.5, 'Soil check', {'layers': DRYING}),
    (21.55, 'Soil check', {'layers': DRY}),
    (21.5, 'Watered', {'amount_ml': 400}),
    (17, 'Soil check', {'layers': MOIST}),
    (12.5, 'Soil check', {'layers': DRYING}),
    (11.55, 'Soil check', {'layers': DRY}),
    (11.5, 'Watered', {'amount_ml': 350}),
    (8, 'Soil check', {'layers': MOIST}),
    (3.5, 'Soil check', {'layers': DRYING}),
    (3.05, 'Soil check', {'layers': DRY}),
    (3, 'Watered', {'amount_ml': 400}),
    (2, 'Observation', {'visual': 'great'}),
]


def example_id(owner: str) -> str:
    return f'example-{owner}'


def is_example(plant: Plant) -> bool:
    return bool(plant.data.get('example'))


def seed_example(db, owner: str, lang: str = 'en') -> str:
    """Add the example plant and its history. Returns the plant id."""
    now = utcnow()
    plant_id = example_id(owner)
    db.add(Plant(id=plant_id, owner_id=owner, data={
        'id': plant_id, 'kind': 'monstera', 'species': 'Monstera deliciosa', 'name': NAMES.get(lang, NAMES['en']),
        'photo': None, 'room': 'Not sure', 'pot': 'Medium pot', 'light': 'Bright indirect light',
        'time_with_owner': 'Not sure', 'stage': 'Young', 'environment': {'location': 'Indoors', 'near_window': 'Yes'},
        'drainage': 'Yes', 'material': 'Plastic', 'self_watering': 'No', 'substrate': 'Regular potting mix',
        'example': True,
    }))
    db.flush()
    for i, (days, kind, value) in enumerate(HISTORY):
        at = (now - timedelta(days=days)).isoformat()
        record = {'note': '', 'soil': summarize(value['layers'], 'half') if 'layers' in value else None, 'amount_ml': value.get('amount_ml'),
                  **({'layers': value['layers']} if 'layers' in value else {}), **({'visual': value['visual']} if 'visual' in value else {})}
        db.add(UserObservation(id=f'{plant_id}-{i}', plant_id=plant_id, owner_id=owner, kind=kind, value=record,
                               observed_at=at, received_at=now.isoformat(), confidence=.65))
        # The append-only log says these records were generated for the example.
        db.add(DomainEvent(id=f'example:{plant_id}-{i}', plant_id=plant_id, type=EVENT_TYPES[kind], source='USER',
                           observation_id=f'{plant_id}-{i}', occurred_at=at, payload={**record, 'example': True}))
    db.flush()
    return plant_id
