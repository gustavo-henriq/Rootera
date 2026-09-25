from .guidance import SensorlessGuidance
import hashlib
import secrets
from uuid import uuid4
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from fastapi import HTTPException
from .db import Plant, Profile, UserObservation, Device, Calibration, SensorObservation, DomainEvent, TwinSnapshot
from .domain import Evidence, PlantTwinEngine, normalize_adc, utcnow
from .schemas import PlantIn, UserObservationIn, SensorIn, CalibrationIn

def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

class GardenService:
    def __init__(self, db: Session, owner: str):
        self.db, self.owner = db, owner
        self.engine = PlantTwinEngine()

    def plant(self, plant_id: str, lock: bool = False) -> Plant:
        # Atomic update obtains the write lock on SQLite and row lock on PostgreSQL.
        if lock:
            self.db.execute(update(Plant).where(Plant.id == plant_id, Plant.owner_id == self.owner).values(revision=Plant.revision + 1))
        p = self.db.scalar(select(Plant).where(Plant.id == plant_id, Plant.owner_id == self.owner))
        if p is None:
            raise HTTPException(404, 'Plant not found')
        return p

    def add_plant(self, payload: PlantIn):
        profile = self.db.scalar(select(Profile).where(Profile.id == self.owner).with_for_update())
        # Force serialization of additions before checking plan capacity on SQLite.
        self.db.execute(update(Profile).where(Profile.id == self.owner).values(data=profile.data))
        existing = self.db.get(Plant, payload.id)
        data = payload.model_dump()
        if existing:
            if existing.owner_id != self.owner or existing.data != data:
                raise HTTPException(409, 'Plant ID already used with different data')
            return existing.data
        capacity = {'Free': 3, 'Seed': 10, 'Grow': 30, 'Thrive': float('inf')}[profile.data['plan']]
        if len(self.db.scalars(select(Plant).where(Plant.owner_id == self.owner)).all()) >= capacity:
            raise HTTPException(409, 'Plant limit reached. Choose a larger plan.')
        self.db.add(Plant(id=payload.id, owner_id=self.owner, data=data))
        self.db.flush()
        self.rebuild(payload.id)
        return data

    def evidence(self, plant_id: str):
        user = self.db.scalars(select(UserObservation).where(UserObservation.plant_id == plant_id)).all()
        sensor = self.db.scalars(select(SensorObservation).where(SensorObservation.plant_id == plant_id)).all()
        return [Evidence(o.id, 'USER', o.kind, o.value, o.observed_at, o.confidence) for o in user] + [Evidence(o.id, 'SENSOR', 'SoilMoistureMeasured', {'moisture': o.normalized}, o.observed_at, o.quality, o.demo) for o in sensor]

    def rebuild(self, plant_id: str):
        evidence = self.evidence(plant_id)
        state = self.engine.project(plant_id, evidence)
        state['guidance'] = SensorlessGuidance().project(self.plant(plant_id).data, self.db.get(Profile, self.owner).data.get('caregiver') or {}, evidence)
        row = self.db.get(TwinSnapshot, plant_id)
        if row is None:
            row = TwinSnapshot(plant_id=plant_id, engine_version=self.engine.version, evaluated_at=state['evaluated_at'], state=state)
            self.db.add(row)
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
        row = UserObservation(id=payload.id, plant_id=plant_id, owner_id=self.owner, kind=payload.type, value=value, observed_at=at, received_at=utcnow().isoformat(), confidence=.65)
        self.db.add(row)
        self.db.add(DomainEvent(id=f'user:{payload.id}', plant_id=plant_id, type={'Watered': 'PlantWatered', 'Soil check': 'SoilConditionReported', 'Fertilized': 'PlantFertilized', 'Observation': 'PlantObserved'}[payload.type], source='USER', observation_id=payload.id, occurred_at=at, payload=value))
        self.db.flush()
        return {'id': row.id, 'duplicate': False, 'twin': self.rebuild(plant_id)}

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
        event = DomainEvent(id=f'sensor:{row.id}', plant_id=device.plant_id, type='SoilMoistureMeasured', source='SENSOR', observation_id=row.id, occurred_at=at, payload={'raw_adc': row.raw_adc, 'normalized_percent': value, 'calibration_version': cal.version, 'demo': device.demo})
        self.db.add(event)
        if value < 25 and not device.demo and payload.signal_quality >= .5:
            self.db.add(DomainEvent(id=f'low:{row.id}', plant_id=device.plant_id, type='LowSoilMoistureDetected', source='SENSOR', observation_id=row.id, occurred_at=at, payload={'normalized_percent': value, 'provisional_threshold': 25}))
        self.db.flush()
        twin = self.rebuild(device.plant_id)
        return {'id': row.id, 'duplicate': False, 'normalized_percent': value, 'twin': twin}

    def snapshot(self):
        profile = self.db.get(Profile, self.owner)
        plants = self.db.scalars(select(Plant).where(Plant.owner_id == self.owner).order_by(Plant.id)).all()
        observations = self.db.scalars(select(UserObservation).where(UserObservation.owner_id == self.owner).order_by(UserObservation.observed_at)).all()
        sensors = []
        for d in self.db.scalars(select(Device).where(Device.owner_id == self.owner, Device.active == True)).all():
            cal = self.db.scalar(select(Calibration).where(Calibration.device_id == d.id).order_by(Calibration.version.desc()))
            last = self.db.scalar(select(SensorObservation).where(SensorObservation.device_id == d.id).order_by(SensorObservation.observed_at.desc(), SensorObservation.id.desc()))
            sensors.append({'id': d.id, 'plantId': d.plant_id, 'name': d.name, 'dry': cal.dry if cal else 3295, 'wet': cal.wet if cal else 1422, 'moisture': last.normalized if last else None, 'source': 'SENSOR', 'observedAt': last.observed_at if last else None, 'demo': d.demo, 'calibrationVersion': cal.version if cal else None})
        twins = {p.id: self.rebuild(p.id) for p in plants}
        return {'version': 1, **profile.data, 'plants': [p.data for p in plants], 'events': [{'id': o.id, 'plantId': o.plant_id, 'type': o.kind, 'note': o.value['note'], 'soil': o.value.get('soil'), 'amount_ml': o.value.get('amount_ml'), 'visual': o.value.get('visual'), 'at': o.observed_at, 'source': 'USER'} for o in observations], 'sensors': sensors, 'twins': twins}
