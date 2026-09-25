"""Soil sensor devices. Out of the MVP interface, kept so hardware can return later
without mixing sensor measurements with caregiver observations."""
import secrets
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from ..db import Device
from ..deps import bearer, demo_only, service, session
from ..schemas import CalibrationIn, DemoSensorIn, DeviceIn, SensorIn
from ..service import GardenService, digest

router = APIRouter(prefix='/v1')


@router.post('/devices', status_code=201)
def device(payload: DeviceIn, s=Depends(service)):
    d, token = s.add_device(payload.plant_id, payload.name)
    return {'id': d.id, 'plant_id': d.plant_id, 'device_token': token, 'note': 'Save this token on your ESP32. Only the hash is stored; token is shown once.'}


@router.post('/devices/{device_id}/calibrations', status_code=201)
def calibrate(device_id: str, payload: CalibrationIn, s=Depends(service)):
    c = s.calibrate(device_id, payload)
    return {'id': c.id, 'version': c.version, 'dry': c.dry, 'wet': c.wet}


@router.delete('/devices/{device_id}')
def revoke(device_id: str, s=Depends(service)):
    s.device(device_id).active = False
    return {'revoked': True}


@router.post('/devices/{device_id}/readings', status_code=201)
def reading(device_id: str, payload: SensorIn, auth: HTTPAuthorizationCredentials = Depends(bearer), db=Depends(session)):
    d = db.get(Device, device_id)
    if d is None or not secrets.compare_digest(d.token_hash, digest(auth.credentials)):
        raise HTTPException(401, 'Invalid device credential')
    return GardenService(db, d.owner_id).ingest(d, payload)


@router.post('/demo/sensors', dependencies=[Depends(demo_only)])
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
