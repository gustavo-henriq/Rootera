import json
import os
import secrets
from contextlib import asynccontextmanager
from datetime import timezone
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from .db import Base, Profile, Plant, Device, UserObservation, SensorObservation, DomainEvent, make_database
from .schemas import PlantIn, UserObservationIn, DeviceIn, CalibrationIn, SensorIn, DemoSensorIn, ProfileIn, DemoPlanIn
from .service import GardenService, digest

def create_app(database_url=None, demo=None, tokens=None):
    demo = os.getenv('ROOTERA_DEMO', 'true').lower() == 'true' if demo is None else demo
    tokens = tokens if tokens is not None else json.loads(os.getenv('ROOTERA_USER_TOKENS', '{}'))
    if demo:
        tokens = {**tokens, 'rootera-local-demo': 'demo'}
    if not tokens:
        raise RuntimeError('Configure ROOTERA_USER_TOKENS when demo mode is disabled.')
    engine, factory = make_database(database_url)

    @asynccontextmanager
    async def lifespan(app):
        # Initial schema for the starter. Use reviewed migrations for subsequent releases.
        Base.metadata.create_all(engine)
        with factory.begin() as db:
            for owner in set(tokens.values()):
                if db.get(Profile, owner) is None:
                    db.add(Profile(id=owner, data={'name': 'Gustavo' if owner == 'demo' else 'Gardener', 'onboarded': False, 'plan': 'Free', 'annual': False, 'reminders': True}))
                    db.flush()
                    if owner == 'demo' and os.getenv('ROOTERA_SEED_DEMO', 'false').lower() == 'true':
                        for i, (name, species, kind) in enumerate([('Aloe Vera', 'Aloe barbadensis miller', 'aloe'), ('Peace Lily', 'Spathiphyllum wallisii', 'peace-lily'), ('Monstera', 'Monstera deliciosa', 'monstera')]):
                            p = PlantIn(id=f'plant-{i}', name=name, species=species, kind=kind, room='Bedroom' if i == 1 else 'Living room', pot='Medium pot', light='Bright indirect light')
                            GardenService(db, owner).add_plant(p)
        yield
        engine.dispose()

    app = FastAPI(title='Rootera Plant Twin API', version='1.0.0', lifespan=lifespan)
    app.state.factory = factory
    app.add_middleware(CORSMiddleware, allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:8081,http://127.0.0.1:8081').split(','), allow_methods=['GET', 'POST', 'PATCH', 'DELETE'], allow_headers=['Authorization', 'Content-Type'])
    bearer = HTTPBearer()

    def owner(auth: HTTPAuthorizationCredentials = Depends(bearer)):
        for token, user in tokens.items():
            if secrets.compare_digest(token, auth.credentials):
                return user
        raise HTTPException(401, 'Invalid user token')

    def session():
        with factory.begin() as db:
            yield db

    def service(user=Depends(owner), db=Depends(session)):
        return GardenService(db, user)

    def demo_only():
        if not demo:
            raise HTTPException(403, 'Demo operations are disabled')

    @app.get('/health')
    def health():
        with factory() as db:
            db.execute(select(1))
        return {'status': 'ok', 'demo': demo, 'twin_engine': 'rules-1.0.0'}

    @app.get('/v1/garden')
    def garden(s=Depends(service)):
        return s.snapshot()

    @app.patch('/v1/profile')
    def profile(payload: ProfileIn, s=Depends(service)):
        p = s.db.get(Profile, s.owner)
        p.data = {**p.data, **payload.model_dump(exclude_unset=True, exclude_none=True)}
        return p.data

    @app.post('/v1/demo/plan', dependencies=[Depends(demo_only)])
    def plan(payload: DemoPlanIn, s=Depends(service)):
        p = s.db.get(Profile, s.owner)
        p.data = {**p.data, **payload.model_dump()}
        return {'demo': True, **payload.model_dump()}

    @app.post('/v1/plants', status_code=201)
    def add_plant(payload: PlantIn, s=Depends(service)):
        return s.add_plant(payload)

    @app.post('/v1/plants/{plant_id}/user-observations', status_code=201)
    def observation(plant_id: str, payload: UserObservationIn, s=Depends(service)):
        return s.add_user_observation(plant_id, payload)

    @app.get('/v1/plants/{plant_id}/user-observations')
    def user_history(plant_id: str, s=Depends(service)):
        s.plant(plant_id)
        rows = s.db.scalars(select(UserObservation).where(UserObservation.plant_id == plant_id).order_by(UserObservation.observed_at)).all()
        return [{'id': r.id, 'type': r.kind, 'source': 'USER', 'value': r.value, 'observed_at': r.observed_at, 'confidence': r.confidence} for r in rows]

    @app.get('/v1/plants/{plant_id}/sensor-observations')
    def sensor_history(plant_id: str, s=Depends(service)):
        s.plant(plant_id)
        rows = s.db.scalars(select(SensorObservation).where(SensorObservation.plant_id == plant_id).order_by(SensorObservation.observed_at)).all()
        return [{'id': r.id, 'source': 'SENSOR', 'device_id': r.device_id, 'raw_adc': r.raw_adc, 'normalized_percent': r.normalized, 'calibration_id': r.calibration_id, 'observed_at': r.observed_at, 'quality': r.quality, 'demo': r.demo} for r in rows]

    @app.get('/v1/plants/{plant_id}/twin')
    def twin(plant_id: str, s=Depends(service)):
        s.plant(plant_id, lock=True)
        return s.rebuild(plant_id)

    @app.post('/v1/plants/{plant_id}/twin/rebuild')
    def rebuild(plant_id: str, s=Depends(service)):
        s.plant(plant_id, lock=True)
        return s.rebuild(plant_id)

    @app.get('/v1/plants/{plant_id}/events')
    def events(plant_id: str, s=Depends(service)):
        s.plant(plant_id)
        return [{'id': e.id, 'type': e.type, 'source': e.source, 'observation_id': e.observation_id, 'occurred_at': e.occurred_at, 'payload': e.payload} for e in s.db.scalars(select(DomainEvent).where(DomainEvent.plant_id == plant_id).order_by(DomainEvent.occurred_at)).all()]

    @app.post('/v1/devices', status_code=201)
    def device(payload: DeviceIn, s=Depends(service)):
        d, token = s.add_device(payload.plant_id, payload.name)
        return {'id': d.id, 'plant_id': d.plant_id, 'device_token': token, 'note': 'Save this token on your ESP32. Only the hash is stored; token is shown once.'}

    @app.post('/v1/devices/{device_id}/calibrations', status_code=201)
    def calibrate(device_id: str, payload: CalibrationIn, s=Depends(service)):
        c = s.calibrate(device_id, payload)
        return {'id': c.id, 'version': c.version, 'dry': c.dry, 'wet': c.wet}

    @app.delete('/v1/devices/{device_id}')
    def revoke(device_id: str, s=Depends(service)):
        d = s.device(device_id)
        d.active = False
        return {'revoked': True}

    @app.post('/v1/devices/{device_id}/readings', status_code=201)
    def reading(device_id: str, payload: SensorIn, auth: HTTPAuthorizationCredentials = Depends(bearer), db=Depends(session)):
        d = db.get(Device, device_id)
        if d is None or not secrets.compare_digest(d.token_hash, digest(auth.credentials)):
            raise HTTPException(401, 'Invalid device credential')
        return GardenService(db, d.owner_id).ingest(d, payload)

    @app.post('/v1/demo/sensors', dependencies=[Depends(demo_only)])
    def demo_sensor(payload: DemoSensorIn, s=Depends(service)):
        s.plant(payload.plantId, lock=True)
        d = s.db.get(Device, payload.id)
        if d is None:
            d, _ = s.add_device(payload.plantId, payload.name, True, payload.id)
        if d.owner_id != s.owner or not d.demo or d.plant_id != payload.plantId:
            raise HTTPException(409, 'Cannot replace a real device with a demo')
        c = s.calibrate(d.id, CalibrationIn(dry=payload.dry, wet=payload.wet))
        raw = round(payload.dry - payload.moisture / 100 * (payload.dry - payload.wet))
        return s.ingest(d, SensorIn(message_id=f'demo-{c.id}', raw_adc=raw, calibration_version=c.version, observed_at=payload.observedAt))

    return app

app = create_app()
