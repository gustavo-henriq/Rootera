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

NAMES = {'en': 'Monstera', 'pt': 'Costela-de-adão'}
EVENT_TYPES = {'Watered': 'PlantWatered', 'Soil check': 'SoilConditionReported', 'Observation': 'PlantObserved'}

# (days before now, kind, value). Three cycles: dry about 5, 6 and 5 days after watering,
# with checks in between as a caregiver would do; the last watering was 3 days ago.
HISTORY = [
    (19, 'Watered', {'amount_ml': 400}),
    (17, 'Soil check', {'soil': 'moist'}),
    (14.05, 'Soil check', {'soil': 'dry'}),
    (14, 'Watered', {'amount_ml': 400}),
    (11, 'Soil check', {'soil': 'slightly_moist'}),
    (8.05, 'Soil check', {'soil': 'dry'}),
    (8, 'Watered', {'amount_ml': 350}),
    (6, 'Soil check', {'soil': 'moist'}),
    (3.05, 'Soil check', {'soil': 'dry'}),
    (3, 'Watered', {'amount_ml': 400}),
    (2, 'Observation', {'visual': 'great'}),
]


def is_example(plant: Plant) -> bool:
    return bool(plant.data.get('example'))


def seed_example(db, owner: str, lang: str = 'en') -> str:
    """Add the example plant and its history. Returns the plant id."""
    now = utcnow()
    plant_id = f'example-{owner}'
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
        record = {'note': '', 'soil': value.get('soil'), 'amount_ml': value.get('amount_ml'), **({'visual': value['visual']} if 'visual' in value else {})}
        db.add(UserObservation(id=f'{plant_id}-{i}', plant_id=plant_id, owner_id=owner, kind=kind, value=record,
                               observed_at=at, received_at=now.isoformat(), confidence=.65))
        # The append-only log says these records were generated for the example.
        db.add(DomainEvent(id=f'example:{plant_id}-{i}', plant_id=plant_id, type=EVENT_TYPES[kind], source='USER',
                           observation_id=f'{plant_id}-{i}', occurred_at=at, payload={**record, 'example': True}))
    db.flush()
    return plant_id
