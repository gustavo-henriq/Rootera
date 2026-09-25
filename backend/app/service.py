import hashlib
import secrets
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from .db import Calibration, Device, DomainEvent, Plant, Profile, SensorObservation, TwinSnapshot, UserObservation
from .domain import Evidence, PlantTwinEngine, normalize_adc, utcnow
from .guidance import SensorlessGuidance
from .schemas import PLAN_CAPACITY, CaregiverProfile, CalibrationIn, PlantIn, PlantUpdate, SensorIn, UserObservationIn, normalize_plan

EVENT_TYPES = {'Watered': 'PlantWatered', 'Soil check': 'SoilConditionReported', 'Fertilized': 'PlantFertilized', 'Observation': 'PlantObserved'}


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class GardenService:
    """Use cases for one owner's garden. Routes stay thin; rules live here and in the Twin."""

    def __init__(self, db: Session, owner: str, integrations: dict | None = None):
        self.db, self.owner = db, owner
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
        if capacity is not None and len(self.active_plants()) >= capacity:
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

    def project(self, plant_id: str, plant: Plant | None = None) -> dict:
        """Compute the Twin without writing. Used for reads."""
        plant = plant or self.plant(plant_id)
        evidence = self.evidence(plant_id)
        state = self.engine.project(plant_id, evidence)
        caregiver = self.db.get(Profile, self.owner).data.get('caregiver') or {}
        state['guidance'] = SensorlessGuidance().project(plant.data, caregiver, evidence)
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
        self.plant(plant_id, lock=True)
        old = self.db.get(UserObservation, payload.id)
        value = {'note': payload.note, 'soil': payload.soil, 'amount_ml': payload.amount_ml}
        if payload.visual is not None:
            value['visual'] = payload.visual
        at = payload.observed_at.isoformat()
        if old:
            if old.plant_id != plant_id or old.owner_id != self.owner or old.kind != payload.type or old.value != value or old.observed_at != at:
                raise HTTPException(409, 'Observation ID reused with different data')
            return {'id': old.id, 'duplicate': True, 'twin': self.rebuild(plant_id)}
        before = self.project(plant_id)['guidance']
        row = UserObservation(id=payload.id, plant_id=plant_id, owner_id=self.owner, kind=payload.type, value=value, observed_at=at, received_at=utcnow().isoformat(), confidence=.65)
        self.db.add(row)
        self.db.add(DomainEvent(id=f'user:{payload.id}', plant_id=plant_id, type=EVENT_TYPES[payload.type], source='USER', observation_id=payload.id, occurred_at=at, payload=value))
        self.db.flush()
        twin = self.rebuild(plant_id)
        after = twin['guidance']
        # Tell the caregiver what changed because of this record.
        change = None if (before['title'], before['action']) == (after['title'], after['action']) else {'from': before['title'], 'to': after['title']}
        return {'id': row.id, 'duplicate': False, 'twin': twin, 'change': change}

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

    # ---- read model --------------------------------------------------------
    def snapshot(self):
        profile = self.profile()
        plants = self.active_plants()
        ids = {p.id for p in plants}
        observations = self.db.scalars(select(UserObservation).where(UserObservation.owner_id == self.owner).order_by(UserObservation.observed_at)).all()
        sensors = []
        for d in self.db.scalars(select(Device).where(Device.owner_id == self.owner, Device.active == True)).all():
            if d.plant_id not in ids:
                continue
            cal = self.db.scalar(select(Calibration).where(Calibration.device_id == d.id).order_by(Calibration.version.desc()))
            last = self.db.scalar(select(SensorObservation).where(SensorObservation.device_id == d.id).order_by(SensorObservation.observed_at.desc(), SensorObservation.id.desc()))
            sensors.append({'id': d.id, 'plantId': d.plant_id, 'name': d.name, 'dry': cal.dry if cal else 3295, 'wet': cal.wet if cal else 1422, 'moisture': last.normalized if last else None, 'source': 'SENSOR', 'observedAt': last.observed_at if last else None, 'demo': d.demo, 'calibrationVersion': cal.version if cal else None})
        twins = {p.id: self.project(p.id, p) for p in plants}
        view = self.profile_view(profile.data)
        capacity = PLAN_CAPACITY[view['plan']]
        return {'version': 1, 'user_id': self.owner, **view, 'plan_capacity': capacity,
                'plants': [p.data for p in plants],
                'events': [{'id': o.id, 'plantId': o.plant_id, 'type': o.kind, 'note': o.value['note'], 'soil': o.value.get('soil'), 'amount_ml': o.value.get('amount_ml'), 'visual': o.value.get('visual'), 'at': o.observed_at, 'source': 'USER'} for o in observations if o.plant_id in ids],
                'sensors': sensors, 'twins': twins, 'integrations': self.integrations}
