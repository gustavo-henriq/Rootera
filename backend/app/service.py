from collections import defaultdict
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import and_, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .db import DomainEvent, Plant, Profile, TwinSnapshot, UserObservation
from .domain import Evidence, utcnow
from .example import NAME as EXAMPLE_NAME, OLD_NAMES, example_id, is_example, seed_example
from .guidance import SensorlessGuidance
from .soil import summarize
from .species import notes_for
from .integrations.plantnet import kind_for
from .integrations import weather as weather_api
from .schemas import PLAN_CAPACITY, CaregiverProfile, NudgePrefs, PlantIn, PlantUpdate, UserObservationIn, normalize_plan

# The garden snapshot carries the most recent care records; older ones are paged by journal().
EVENT_WINDOW = 400
# What the app reads from a twin in the garden snapshot. The full twin (every guidance field,
# evidence ids, limitations) stays available per plant at /v1/plants/{id}/twin.
LEAN_GUIDANCE = ('title', 'reason', 'action', 'tip', 'basis', 'state', 'learning', 'baseline_days', 'completed_cycles', 'pattern_cycles', 'cycle_days', 'forecast',
                 'baseline_note', 'soil', 'soil_layers', 'soil_checked_at', 'visual', 'last_watered_at', 'last_soil_check_at', 'reference')


def lean_twin(state: dict) -> dict:
    return {'guidance': {k: state['guidance'].get(k) for k in LEAN_GUIDANCE}, 'sources': state.get('sources')}

EVENT_TYPES = {'Watered': 'PlantWatered', 'Soil check': 'SoilConditionReported', 'Fertilized': 'PlantFertilized', 'Observation': 'PlantObserved'}



class GardenService:
    """Use cases for one owner's garden. Routes stay thin; rules live here and in the Twin."""

    def __init__(self, db: Session, owner: str, integrations: dict | None = None, lang: str = 'en', seed_example: bool = False):
        # `lang` words the garden snapshot's guidance; stored twins and change reports stay in English.
        self.db, self.owner, self.lang, self.seed_example = db, owner, lang, seed_example
        self.integrations = integrations or {}

    # ---- profile -----------------------------------------------------------
    def profile(self) -> Profile:
        p = self.db.get(Profile, self.owner)
        if p is None:
            raise HTTPException(404, 'Profile not found')
        return p

    def update_profile(self, changes: dict) -> dict:
        p = self.profile()
        p.data = {**p.data, **changes}
        return self.profile_view(p.data)

    def set_location(self, lat: float | None, lon: float | None, name: str | None) -> dict:
        p = self.profile()
        data = {k: v for k, v in p.data.items() if k != 'location'}
        if lat is not None and lon is not None:
            rlat, rlon = weather_api.place(lat, lon)
            data['location'] = {'lat': rlat, 'lon': rlon, 'place': (name or '').strip() or None}
        p.data = data
        self._weather = None
        w = self.weather()
        return {'location': data.get('location'), 'weather': {k: v for k, v in w.items() if k != 'daily'} if w else None}

    def weather(self) -> dict | None:
        """This week's weather at the caregiver's place, once per request (cached by place)."""
        if getattr(self, '_weather', None) is None:
            loc = (self.profile().data or {}).get('location')
            self._weather = (weather_api.recent(loc['lat'], loc['lon']) or False) if loc else False
        return self._weather or None

    def set_plan(self, plan: str, annual: bool, source: str) -> dict:
        p = self.profile()
        p.data = {**p.data, 'plan': plan, 'annual': annual, 'plan_source': source}
        return {'plan': plan, 'annual': annual, 'source': source}

    @staticmethod
    def profile_view(data: dict) -> dict:
        view = {**data, 'plan': normalize_plan(data.get('plan'))}
        view.setdefault('name', '')
        if data.get('caregiver'):
            view['caregiver'] = CaregiverProfile.model_validate(data['caregiver']).model_dump(exclude_none=True)
        view['nudges'] = NudgePrefs.model_validate(data.get('nudges') or {}).model_dump()
        return view

    # ---- plants ------------------------------------------------------------
    def plant(self, plant_id: str, lock: bool = False) -> Plant:
        # Atomic update obtains the write lock on SQLite and a row lock on PostgreSQL.
        if lock:
            self.db.execute(update(Plant).where(Plant.id == plant_id, Plant.owner_id == self.owner).values(revision=Plant.revision + 1))
        p = self.db.scalar(select(Plant).where(Plant.id == plant_id, Plant.owner_id == self.owner))
        if p is None:
            raise HTTPException(404, 'Plant not found')
        return p

    def active_plants(self) -> list[Plant]:
        rows = self.db.scalars(select(Plant).where(Plant.owner_id == self.owner).order_by(Plant.id)).all()
        return [p for p in rows if not p.data.get('archived')]

    def add_plant(self, payload: PlantIn):
        profile = self.db.scalar(select(Profile).where(Profile.id == self.owner).with_for_update())
        # Force serialization of additions before checking plan capacity on SQLite.
        self.db.execute(update(Profile).where(Profile.id == self.owner).values(data=profile.data))
        existing = self.db.get(Plant, payload.id)
        data = payload.model_dump()
        if existing:
            if existing.owner_id != self.owner or {k: v for k, v in existing.data.items() if k != 'archived'} != data:
                raise HTTPException(409, 'Plant ID already used with different data')
            return existing.data
        capacity = PLAN_CAPACITY[normalize_plan(profile.data.get('plan'))]
        # The example plant never takes one of the plan's spots.
        if capacity is not None and len([p for p in self.active_plants() if not is_example(p)]) >= capacity:
            raise HTTPException(409, 'Plant limit reached for your plan.')
        self.db.add(Plant(id=payload.id, owner_id=self.owner, data=data))
        self.db.flush()
        self.rebuild(payload.id)
        return data

    def update_plant(self, plant_id: str, payload: PlantUpdate):
        p = self.plant(plant_id, lock=True)
        if p.data.get('archived'):
            raise HTTPException(404, 'Plant not found')
        changes = payload.model_dump(exclude_unset=True, exclude_none=True, mode='json')
        seen = changes.pop('art_seen', False)
        data = {**p.data, **changes}
        if seen:
            data.pop('art_new', None)
        p.data = data
        self.db.flush()
        self.rebuild(plant_id)
        return p.data

    def archive_plant(self, plant_id: str, reason: str = 'removed'):
        # History is preserved; the plant leaves the garden and frees plan capacity.
        p = self.plant(plant_id, lock=True)
        p.data = {**p.data, 'archived': True, 'archived_at': utcnow().isoformat(), 'archived_reason': reason}
        return {'archived': True, 'reason': reason}

    # ---- evidence and twin -------------------------------------------------
    def evidence(self, plant_id: str):
        user = self.db.scalars(select(UserObservation).where(UserObservation.plant_id == plant_id)).all()
        return [Evidence(o.id, 'USER', o.kind, o.value, o.observed_at, o.confidence) for o in user]

    def project(self, plant_id: str, plant: Plant | None = None, evidence: list | None = None,
                caregiver: dict | None = None, lang: str = 'en') -> dict:
        """Compute the Twin without writing. Used for reads. The snapshot passes preloaded
        evidence and caregiver so a garden costs a few queries, not a few per plant.
        The Twin is the guidance and its sources: one set of rules decides which check is
        current, so no two parts of it can disagree about the soil."""
        plant = plant or self.plant(plant_id)
        evidence = self.evidence(plant_id) if evidence is None else evidence
        if caregiver is None:
            caregiver = self.db.get(Profile, self.owner).data.get('caregiver') or {}
        w = self.weather()
        guidance = SensorlessGuidance().project({**plant.data, 'weather': w} if w else plant.data, caregiver, evidence, lang=lang)
        return {'plant_id': plant_id, 'engine_version': SensorlessGuidance.version, 'evaluated_at': utcnow().isoformat(),
                'evidence_count': len(evidence), 'guidance': guidance,
                'sources': {
                    'user': {'observations': len(evidence)},
                    'external': {'weather': bool(w), 'identification': bool(self.integrations.get('identification'))},
                    'reference': {'species_notes': plant.data.get('kind') != 'other'},
                },
                'limitations': ['Rules from your checks and published care guidance; not a trained predictive model.']}

    def rebuild(self, plant_id: str):
        state = self.project(plant_id)
        row = self.db.get(TwinSnapshot, plant_id)
        if row is None:
            self.db.add(TwinSnapshot(plant_id=plant_id, engine_version=state['engine_version'], evaluated_at=state['evaluated_at'], state=state))
        else:
            row.state, row.engine_version, row.evaluated_at = state, state['engine_version'], state['evaluated_at']
        return state

    def add_user_observation(self, plant_id: str, payload: UserObservationIn):
        plant = self.plant(plant_id, lock=True)
        if plant.data.get('archived'):
            raise HTTPException(404, 'Plant not found')
        old = self.db.get(UserObservation, payload.id)
        value = {'note': payload.note, 'soil': payload.soil, 'amount_ml': payload.amount_ml}
        if payload.layers is not None:
            # The layers are kept as said; the single reading is judged at this species' depth.
            value['layers'] = payload.layers.model_dump()
            value['soil'] = summarize(value['layers'], notes_for(plant.data.get('kind'))['dryness'])
        if payload.visual is not None:
            value['visual'] = payload.visual
        if payload.approximate:
            value['approximate'] = True
        at = payload.observed_at.isoformat()
        if old:
            if old.plant_id != plant_id or old.owner_id != self.owner or old.kind != payload.type or old.value != value or old.observed_at != at:
                raise HTTPException(409, 'Observation ID reused with different data')
            return {'id': old.id, 'duplicate': True, 'twin': self.rebuild(plant_id)}
        before = self.project(plant_id)['guidance']
        row = UserObservation(id=payload.id, plant_id=plant_id, owner_id=self.owner, kind=payload.type, value=value, observed_at=at, received_at=utcnow().isoformat(), confidence=.65)
        self.db.add(row)
        # A record restored after an undo keeps its id; the append-only log gets a new entry for it.
        event_id = f'user:{payload.id}' if self.db.get(DomainEvent, f'user:{payload.id}') is None else f'user:{payload.id}:restored:{uuid4().hex[:8]}'
        self.db.add(DomainEvent(id=event_id, plant_id=plant_id, type=EVENT_TYPES[payload.type], source='USER', observation_id=payload.id, occurred_at=at, payload=value))
        self.db.flush()
        twin = self.rebuild(plant_id)
        after = twin['guidance']
        # Tell the caregiver what changed because of this record.
        change = None if (before['title'], before['action']) == (after['title'], after['action']) else {'from': before['title'], 'to': after['title']}
        return {'id': row.id, 'duplicate': False, 'twin': twin, 'change': change}

    def remove_user_observation(self, plant_id: str, observation_id: str):
        """Undo a care record. The record leaves the plant's evidence; the domain log stays
        append-only and gains a retraction, so history remains auditable."""
        self.plant(plant_id, lock=True)
        row = self.db.get(UserObservation, observation_id)
        if row is None or row.plant_id != plant_id or row.owner_id != self.owner:
            raise HTTPException(404, 'Record not found')
        before = self.project(plant_id)['guidance']
        self.db.add(DomainEvent(id=f'retract:{observation_id}:{uuid4().hex[:8]}', plant_id=plant_id, type='UserObservationRetracted', source='USER',
                                observation_id=observation_id, occurred_at=utcnow().isoformat(), payload={'kind': row.kind, 'value': row.value, 'observed_at': row.observed_at}))
        self.db.delete(row)
        self.db.flush()
        twin = self.rebuild(plant_id)
        after = twin['guidance']
        change = None if (before['title'], before['action']) == (after['title'], after['action']) else {'from': before['title'], 'to': after['title']}
        return {'removed': True, 'twin': twin, 'change': change}

    def journal(self, before: str | None = None, limit: int = 100, plant_id: str | None = None, before_id: str | None = None):
        """Older care records, newest first, for paging past the snapshot window.

        The cursor is the last record shown (its time and id), so records that share a time
        at a page boundary are neither skipped nor repeated. Records of plants that left the
        garden are filtered before the limit, so a page is never short while `more` is true."""
        U = UserObservation
        ids = [p.id for p in self.active_plants()]
        q = select(U).where(U.owner_id == self.owner, U.plant_id.in_(ids))
        if plant_id:
            q = q.where(U.plant_id == plant_id)
        if before:
            q = q.where(or_(U.observed_at < before, and_(U.observed_at == before, U.id < before_id)) if before_id else U.observed_at < before)
        rows = self.db.scalars(q.order_by(U.observed_at.desc(), U.id.desc()).limit(limit + 1)).all()
        return {'events': [self.event_view(o) for o in rows[:limit]], 'more': len(rows) > limit}

    @staticmethod
    def event_view(o):
        return {'id': o.id, 'plantId': o.plant_id, 'type': o.kind, 'note': o.value['note'], 'soil': o.value.get('soil'), 'layers': o.value.get('layers'), 'amount_ml': o.value.get('amount_ml'), 'visual': o.value.get('visual'), 'approximate': bool(o.value.get('approximate')), 'at': o.observed_at, 'source': 'USER'}

    def ensure_example(self, profile: Profile):
        """Add the example plant once. Its row (kept when archived) is the record that it was
        added, so removing it never brings it back and the profile is never rewritten here.
        Two first loads at once: the second insert hits the same id and is dropped."""
        existing = self.db.get(Plant, example_id(self.owner))
        if existing is not None and existing.data.get('name') in OLD_NAMES:
            existing.data = {**existing.data, 'name': EXAMPLE_NAME}
        if profile.data.get('example_seeded') or existing is not None:
            return
        try:
            with self.db.begin_nested():
                seed_example(self.db, self.owner, self.lang)
        except IntegrityError:
            return
        self.rebuild(example_id(self.owner))

    def upgrade_art(self, plants: list[Plant]):
        """A plant added before Rootera had its species (shown in the plain pot) gets the
        species' illustration and notes as soon as a version knows it. `art_new` tells the app
        to announce it once; the caregiver clears it (art_seen)."""
        for p in plants:
            if p.data.get('kind') != 'other' or not p.data.get('species'):
                continue
            kind = kind_for(p.data['species'])
            if kind != 'other':
                p.data = {**p.data, 'kind': kind, 'art_new': True}
                self.db.flush()
                self.rebuild(p.id)

    # ---- read model --------------------------------------------------------
    def snapshot(self):
        profile = self.profile()
        if self.seed_example:
            self.ensure_example(profile)
        plants = self.active_plants()
        self.upgrade_art(plants)
        ids = {p.id for p in plants}
        # Plain rows, not ORM objects: a large garden carries 100k+ records and the identity
        # map costs more than the twins themselves. Rows keep the attribute names event_view reads.
        U = UserObservation
        observations = self.db.execute(select(U.id, U.plant_id, U.kind, U.value, U.observed_at, U.confidence)
                                       .where(U.owner_id == self.owner).order_by(U.observed_at, U.id)).all()
        # Batch everything the twins need: one pass over the records.
        evidence = defaultdict(list)
        for o in observations:
            evidence[o.plant_id].append(Evidence(o.id, 'USER', o.kind, o.value, o.observed_at, o.confidence))
        caregiver = profile.data.get('caregiver') or {}
        twins = {p.id: lean_twin(self.project(p.id, p, evidence[p.id], caregiver, lang=self.lang)) for p in plants}
        mine = [o for o in observations if o.plant_id in ids]
        view = self.profile_view(profile.data)
        capacity = PLAN_CAPACITY[view['plan']]
        w = self.weather()
        view['weather'] = {k: v for k, v in w.items() if k != 'daily'} if w else None
        return {'version': 1, 'user_id': self.owner, **view, 'plan_capacity': capacity, 'plan_used': sum(not is_example(p) for p in plants),
                'plants': [p.data for p in plants],
                'events': [self.event_view(o) for o in mine[-EVENT_WINDOW:]], 'events_complete': len(mine) <= EVENT_WINDOW,
                'twins': twins, 'integrations': self.integrations}
