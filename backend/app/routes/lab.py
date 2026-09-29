"""The Shipaton lab: simulate a plant and a watering method through the real guidance
engine (see lab.py). Signed-in only; nothing is stored."""
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import Field

from ..deps import owner
from ..i18n import lang_from
from ..lab import MAX_DAYS, DayInput, LabRun, simulate
from ..schemas import SoilLayers, StrictModel
from ..species import SPECIES_NOTES

router = APIRouter(prefix='/v1/lab')
Kind = Literal[tuple(SPECIES_NOTES)]  # type: ignore[valid-type]


class LabDay(StrictModel):
    day: int = Field(ge=0, lt=MAX_DAYS)
    water: bool | None = None
    check: bool | None = None
    layers: SoilLayers | None = None
    leaves: Literal['great', 'different', 'unwell'] | None = None


class LabIn(StrictModel):
    kind: Kind = 'monstera'
    pot: Literal['Small pot', 'Medium pot', 'Large pot'] = 'Medium pot'
    drainage: Literal['Yes', 'No'] = 'Yes'
    light: Literal['Low light', 'Bright indirect light', 'Direct sun'] = 'Bright indirect light'
    method: Literal['rootera', 'weekly', 'often', 'forgetful', 'manual'] = 'rootera'
    days: int = Field(default=42, ge=7, le=MAX_DAYS)
    check_every: int = Field(default=2, ge=1, le=7)
    # This plant against a typical one: below 1 it dries faster.
    pace: float = Field(default=1.0, ge=.5, le=1.5)
    overrides: list[LabDay] = Field(default_factory=list, max_length=MAX_DAYS)
    # Kept for when a weather source and photos are connected; not simulated yet.
    weather: dict | None = None


@router.post('/simulate')
def run(payload: LabIn, request: Request, _user: str = Depends(owner)):
    overrides = {o.day: DayInput(water=o.water, check=o.check, layers=o.layers.model_dump() if o.layers else None, leaves=o.leaves) for o in payload.overrides}
    plant = {'pot': payload.pot, 'drainage': payload.drainage, 'light': payload.light, 'environment': {'location': 'Indoors'}}
    return simulate(LabRun(kind=payload.kind, plant=plant, method=payload.method, days=payload.days, check_every=payload.check_every,
                           pace=payload.pace, overrides=overrides, lang=lang_from(request.headers.get('accept-language'))))
