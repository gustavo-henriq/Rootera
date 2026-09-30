from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from ..db import DomainEvent, UserObservation
from ..deps import service
from ..schemas import LocationIn, PlantIn, PlantUpdate, ProfileIn, UserObservationIn

router = APIRouter(prefix='/v1')


@router.get('/garden')
def garden(s=Depends(service)):
    return s.snapshot()


@router.patch('/profile')
def profile(payload: ProfileIn, s=Depends(service)):
    return s.update_profile(payload.model_dump(exclude_unset=True, exclude_none=True))


@router.put('/profile/location')
def set_location(payload: LocationIn, s=Depends(service)):
    """Local weather on: the approximate place (rounded before it is stored)."""
    return s.set_location(payload.lat, payload.lon, payload.place)


@router.delete('/profile/location')
def clear_location(s=Depends(service)):
    """Local weather off: the place is forgotten."""
    return s.set_location(None, None, None)


@router.post('/plants', status_code=201)
def add_plant(payload: PlantIn, s=Depends(service)):
    return s.add_plant(payload)


@router.patch('/plants/{plant_id}')
def update_plant(plant_id: str, payload: PlantUpdate, s=Depends(service)):
    return s.update_plant(plant_id, payload)


@router.delete('/plants/{plant_id}')
def archive_plant(plant_id: str, reason: Literal['died', 'given', 'left', 'removed'] = 'removed', s=Depends(service)):
    """A plant leaves the garden; `reason` says why (it died, was given away, was left behind)."""
    return s.archive_plant(plant_id, reason)


@router.post('/plants/{plant_id}/user-observations', status_code=201)
def observation(plant_id: str, payload: UserObservationIn, s=Depends(service)):
    return s.add_user_observation(plant_id, payload)


@router.delete('/plants/{plant_id}/user-observations/{observation_id}')
def remove_observation(plant_id: str, observation_id: str, s=Depends(service)):
    return s.remove_user_observation(plant_id, observation_id)


@router.get('/journal')
def journal(before: str | None = None, before_id: str | None = None, limit: int = Query(100, ge=1, le=500), plant: str | None = None, s=Depends(service)):
    return s.journal(before, limit, plant, before_id)


@router.get('/plants/{plant_id}/user-observations')
def user_history(plant_id: str, s=Depends(service)):
    s.plant(plant_id)
    rows = s.db.scalars(select(UserObservation).where(UserObservation.plant_id == plant_id).order_by(UserObservation.observed_at)).all()
    return [{'id': r.id, 'type': r.kind, 'source': 'USER', 'value': r.value, 'observed_at': r.observed_at, 'confidence': r.confidence} for r in rows]


@router.get('/plants/{plant_id}/twin')
def twin(plant_id: str, s=Depends(service)):
    s.plant(plant_id, lock=True)
    return s.rebuild(plant_id)


@router.post('/plants/{plant_id}/twin/rebuild')
def rebuild(plant_id: str, s=Depends(service)):
    s.plant(plant_id, lock=True)
    return s.rebuild(plant_id)


@router.get('/plants/{plant_id}/events')
def events(plant_id: str, s=Depends(service)):
    s.plant(plant_id)
    rows = s.db.scalars(select(DomainEvent).where(DomainEvent.plant_id == plant_id).order_by(DomainEvent.occurred_at)).all()
    return [{'id': e.id, 'type': e.type, 'source': e.source, 'observation_id': e.observation_id, 'occurred_at': e.occurred_at, 'payload': e.payload} for e in rows]
