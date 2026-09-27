import hashlib
import secrets
from collections import defaultdict
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .db import Calibration, Device, DomainEvent, Plant, Profile, SensorObservation, TwinSnapshot, UserObservation
from .domain import Evidence, PlantTwinEngine, normalize_adc, utcnow
from .example import example_id, is_example, seed_example
from .guidance import SensorlessGuidance
from .schemas import PLAN_CAPACITY, CaregiverProfile, NudgePrefs, CalibrationIn, PlantIn, PlantUpdate, SensorIn, UserObservationIn, normalize_plan

# The garden snapshot carries the most recent care records; older ones are paged by journal().
EVENT_WINDOW = 400
# What the app reads from a twin in the garden snapshot. The full twin (reported, inferred,
# limitations, evidence ids) stays available per plant at /v1/plants/{id}/twin.
LEAN_GUIDANCE = ('title', 'reason', 'action', 'tip', 'basis', 'state', 'learning', 'baseline_days', 'completed_cycles', 'forecast',
                 'baseline_note', 'soil', 'soil_checked_at', 'visual', 'last_watered_at', 'last_soil_check_at', 'reference')


def lean_twin(state: dict) -> dict:
    return {'guidance': {k: state['guidance'].get(k) for k in LEAN_GUIDANCE}, 'measured': state.get('measured'), 'sources': state.get('sources')}

EVENT_TYPES = {'Watered': 'PlantWatered', 'Soil check': 'SoilConditionReported', 'Fertilized': 'PlantFertilized', 'Observation': 'PlantObserved'}


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class GardenService:
    """Use cases for one owner's garden. Routes stay thin; rules live here and in the Twin."""

    def __init__(self, db: Session, owner: str, integrations: dict | None = None, lang: str = 'en', seed_example: bool = False):
        # `lang` words the garden snapshot's guidance; stored twins and change reports stay in English.
        self.db, self.owner, self.lang, self.seed_example = db, owner, lang, seed_example
        self.engine = PlantTwinEngine()
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
        p.data = {**p.data, **payload.model_dump(exclude_unset=True, exclude_none=True, mode='json')}
        self.db.flush()
        self.rebuild(plant_id)
        return p.data

    def archive_plant(self, plant_id: str):
        # History is preserved; the plant leaves the garden and frees plan capacity.
        p = self.plant(plant_id, lock=True)
        p.data = {**p.data, 'archived': True, 'archived_at': utcnow().isoformat()}
        return {'archived': True}

    # ---- evidence and twin -------------------------------------------------
    def evidence(self, plant_id: str):
        user = self.db.scalars(select(UserObservation).where(UserObservation.plant_id == plant_id)).all()
        sensor = self.db.scalars(select(SensorObservation).where(SensorObservation.plant_id == plant_id)).all()
        return [Evidence(o.id, 'USER', o.kind, o.value, o.observed_at, o.confidence) for o in user] + \
               [Evidence(o.id, 'SENSOR', 'SoilMoistureMeasured', {'moisture': o.normalized}, o.observed_at, o.quality, o.demo) for o in sensor]

    def project(self, plant_id: str, plant: Plant | None = None, evidence: list | None = None,
                caregiver: dict | None = None, real_devices: list | None = None, lang: str = 'en') -> dict:
        """Compute the Twin without writing. Used for reads. The snapshot passes preloaded
        evidence, caregiver and devices so a garden costs a few queries, not a few per plant."""
        plant = plant or self.plant(plant_id)
        evidence = self.evidence(plant_id) if evidence is None else evidence
        state = self.engine.project(plant_id, evidence)
        if caregiver is None:
            caregiver = self.db.get(Profile, self.owner).data.get('caregiver') or {}
        state['guidance'] = SensorlessGuidance().project(plant.data, caregiver, evidence, lang=lang)
        if real_devices is None:
            real_devices = self.db.scalars(select(Device).where(Device.plant_id == plant_id, Device.active == True, Device.demo == False)).all()
        state['sources'] = {
            'user': {'observations': sum(e.source == 'USER' for e in evidence)},
            'sensor': {'connected': bool(real_devices), 'readings': sum(e.source == 'SENSOR' and not e.demo for e in evidence)},
            'external': {'weather': False, 'identification': bool(self.integrations.get('identification'))},
            'reference': {'species_notes': plant.data.get('kind') != 'other'},
        }
        return state

    def rebuild(self, plant_id: str):
        state = self.project(plant_id)
        row = self.db.get(TwinSnapshot, plant_id)
        if row is None:
            self.db.add(TwinSnapshot(plant_id=plant_id, engine_version=self.engine.version, evaluated_at=state['evaluated_at'], state=state))
        else:
            row.state, row.engine_version, row.evaluated_at = state, self.engine.version, state['evaluated_at']
        return state

    def add_user_observation(self, plant_id: str, payload: UserObservationIn):
        if self.plant(plant_id, lock=True).data.get('archived'):
            raise HTTPException(404, 'Plant not found')
        old = self.db.get(UserObservation, payload.id)
        value = {'note': payload.note, 'soil': payload.soil, 'amount_ml': payload.amount_ml}
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

    def journal(self, before: str | None = None, limit: int = 100, plant_id: str | None = None):
        """Older care records, newest first, for paging past the snapshot window."""
        ids = {p.id for p in self.active_plants()}
        q = select(UserObservation).where(UserObservation.owner_id == self.owner)
        if plant_id:
            q = q.where(UserObservation.plant_id == plant_id)
        if before:
            q = q.where(UserObservation.observed_at < before)
        rows = self.db.scalars(q.order_by(UserObservation.observed_at.desc()).limit(limit + 1)).all()
        events = [self.event_view(o) for o in rows[:limit] if o.plant_id in ids]
        return {'events': events, 'more': len(rows) > limit}

    @staticmethod
    def event_view(o):
        return {'id': o.id, 'plantId': o.plant_id, 'type': o.kind, 'note': o.value['note'], 'soil': o.value.get('soil'), 'amount_ml': o.value.get('amount_ml'), 'visual': o.value.get('visual'), 'approximate': bool(o.value.get('approximate')), 'at': o.observed_at, 'source': 'USER'}

    # ---- devices (kept for future hardware; not part of the MVP UI) ---------
    def add_device(self, plant_id: str, name: str, demo: bool = False, device_id: str | None = None):
        self.plant(plant_id, lock=True)
        token = secrets.token_urlsafe(32)
        device = Device(id=device_id or str(uuid4()), plant_id=plant_id, owner_id=self.owner, name=name, token_hash=digest(token), demo=demo, active=True)
        self.db.add(device)
        self.db.flush()
        return device, token

    def device(self, device_id: str):
        device = self.db.get(Device, device_id)
        if device is None or device.owner_id != self.owner:
            raise HTTPException(404, 'Device not found')
        return device

    def calibrate(self, device_id: str, data: CalibrationIn):
        device = self.device(device_id)
        self.plant(device.plant_id, lock=True)
        previous = self.db.scalar(select(Calibration).where(Calibration.device_id == device_id).order_by(Calibration.version.desc()))
        calibration = Calibration(id=str(uuid4()), device_id=device_id, version=previous.version + 1 if previous else 1, dry=data.dry, wet=data.wet, created_at=utcnow().isoformat())
        self.db.add(calibration)
        self.db.flush()
        return calibration

    def ingest(self, device: Device, payload: SensorIn):
        self.plant(device.plant_id, lock=True)
        if not device.active:
            raise HTTPException(403, 'Device revoked')
        cal = self.db.scalar(select(Calibration).where(Calibration.device_id == device.id, Calibration.version == payload.calibration_version))
        if cal is None:
            raise HTTPException(409, 'Unknown calibration version. Calibrate the device first.')
        at = payload.observed_at.isoformat()
        old = self.db.scalar(select(SensorObservation).where(SensorObservation.device_id == device.id, SensorObservation.message_id == payload.message_id))
        if old:
            if old.raw_adc != payload.raw_adc or old.calibration_id != cal.id or old.observed_at != at or old.quality != payload.signal_quality:
                raise HTTPException(409, 'Message ID reused with a different measurement')
            return {'id': old.id, 'duplicate': True, 'normalized_percent': old.normalized}
        value = normalize_adc(payload.raw_adc, cal.dry, cal.wet)
        row = SensorObservation(id=str(uuid4()), plant_id=device.plant_id, device_id=device.id, message_id=payload.message_id, calibration_id=cal.id, raw_adc=payload.raw_adc, normalized=value, quality=payload.signal_quality, observed_at=at, received_at=utcnow().isoformat(), demo=device.demo)
        self.db.add(row)
        self.db.flush()
        self.db.add(DomainEvent(id=f'sensor:{row.id}', plant_id=device.plant_id, type='SoilMoistureMeasured', source='SENSOR', observation_id=row.id, occurred_at=at, payload={'raw_adc': row.raw_adc, 'normalized_percent': value, 'calibration_version': cal.version, 'demo': device.demo}))
        if value < 25 and not device.demo and payload.signal_quality >= .5:
            self.db.add(DomainEvent(id=f'low:{row.id}', plant_id=device.plant_id, type='LowSoilMoistureDetected', source='SENSOR', observation_id=row.id, occurred_at=at, payload={'normalized_percent': value, 'provisional_threshold': 25}))
        self.db.flush()
        twin = self.rebuild(device.plant_id)
        return {'id': row.id, 'duplicate': False, 'normalized_percent': value, 'twin': twin}

    def ensure_example(self, profile: Profile):
        """Add the example plant once. Its row (kept when archived) is the record that it was
        added, so removing it never brings it back and the profile is never rewritten here.
        Two first loads at once: the second insert hits the same id and is dropped."""
        if profile.data.get('example_seeded') or self.db.get(Plant, example_id(self.owner)) is not None:
            return
        try:
            with self.db.begin_nested():
                seed_example(self.db, self.owner, self.lang)
        except IntegrityError:
            return
        self.rebuild(example_id(self.owner))

    # ---- read model --------------------------------------------------------
    def snapshot(self):
        profile = self.profile()
        if self.seed_example:
            self.ensure_example(profile)
        plants = self.active_plants()
        ids = {p.id for p in plants}
        # Plain rows, not ORM objects: a large garden carries 100k+ records and the identity
        # map costs more than the twins themselves. Rows keep the attribute names event_view reads.
        U = UserObservation
        observations = self.db.execute(select(U.id, U.plant_id, U.kind, U.value, U.observed_at, U.confidence)
                                       .where(U.owner_id == self.owner).order_by(U.observed_at)).all()
        # Batch everything the twins need: one pass over records, one query for sensor readings.
        evidence = defaultdict(list)
        for o in observations:
            evidence[o.plant_id].append(Evidence(o.id, 'USER', o.kind, o.value, o.observed_at, o.confidence))
        if ids:
            for o in self.db.scalars(select(SensorObservation).where(SensorObservation.plant_id.in_(ids))).all():
                evidence[o.plant_id].append(Evidence(o.id, 'SENSOR', 'SoilMoistureMeasured', {'moisture': o.normalized}, o.observed_at, o.quality, o.demo))
        devices = self.db.scalars(select(Device).where(Device.owner_id == self.owner, Device.active == True)).all()
        real = defaultdict(list)
        for d in devices:
            if not d.demo:
                real[d.plant_id].append(d)
        caregiver = profile.data.get('caregiver') or {}
        sensors = []
        for d in devices:
            if d.plant_id not in ids:
                continue
            cal = self.db.scalar(select(Calibration).where(Calibration.device_id == d.id).order_by(Calibration.version.desc()))
            last = self.db.scalar(select(SensorObservation).where(SensorObservation.device_id == d.id).order_by(SensorObservation.observed_at.desc(), SensorObservation.id.desc()))
            sensors.append({'id': d.id, 'plantId': d.plant_id, 'name': d.name, 'dry': cal.dry if cal else 3295, 'wet': cal.wet if cal else 1422, 'moisture': last.normalized if last else None, 'source': 'SENSOR', 'observedAt': last.observed_at if last else None, 'demo': d.demo, 'calibrationVersion': cal.version if cal else None})
        twins = {p.id: lean_twin(self.project(p.id, p, evidence[p.id], caregiver, real[p.id], lang=self.lang)) for p in plants}
        mine = [o for o in observations if o.plant_id in ids]
        view = self.profile_view(profile.data)
        capacity = PLAN_CAPACITY[view['plan']]
        return {'version': 1, 'user_id': self.owner, **view, 'plan_capacity': capacity, 'plan_used': sum(not is_example(p) for p in plants),
                'plants': [p.data for p in plants],
                'events': [self.event_view(o) for o in mine[-EVENT_WINDOW:]], 'events_complete': len(mine) <= EVENT_WINDOW,
                'sensors': sensors, 'twins': twins, 'integrations': self.integrations}
