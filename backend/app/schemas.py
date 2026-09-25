from datetime import datetime, timedelta, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class CaregiverProfile(StrictModel):
    experience: Literal['Just starting', 'I know the basics', 'Pretty experienced', 'Plant nerd'] = 'Just starting'
    plant_count: Literal['1–3', '4–10', '10+'] = '1–3'
    detail: Literal['Guided', 'Concise'] = 'Guided'

class EnvironmentModel(StrictModel):
    location: Literal['Indoors', 'Outdoors', 'Balcony / patio', 'Not sure'] = 'Not sure'
    near_window: Literal['Yes', 'No', 'Not sure'] = 'Not sure'

class PlantIn(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    name: str = Field(min_length=1, max_length=100)
    species: str = Field(min_length=1, max_length=160)
    kind: Literal['aloe', 'peace-lily', 'monstera']
    room: str = Field(min_length=1, max_length=100)
    pot: str = Field(min_length=1, max_length=100)
    light: str = Field(min_length=1, max_length=120)
    photo: str | None = Field(default=None, max_length=2000)

    time_with_owner: str = Field(default='Not sure', max_length=60)
    stage: Literal['Seedling', 'Young', 'Mature', 'Not sure'] = 'Not sure'
    environment: EnvironmentModel = Field(default_factory=EnvironmentModel)
    drainage: Literal['Yes', 'No', 'Not sure'] = 'Not sure'
    material: str = Field(default='Not sure', max_length=60)
    self_watering: Literal['Yes', 'No', 'Not sure'] = 'Not sure'
    substrate: str = Field(default="I don't know", max_length=100)

class Timed(StrictModel):
    observed_at: datetime
    @field_validator('observed_at')
    @classmethod
    def aware(cls, v):
        if v.tzinfo is None or v.utcoffset() is None:
            raise ValueError('A timezone is required.')
        if v > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError('Observation cannot be more than 5 minutes in the future.')
        return v.astimezone(timezone.utc)

class UserObservationIn(Timed):
    id: str = Field(min_length=1, max_length=80)
    type: Literal['Watered', 'Soil check', 'Fertilized', 'Observation']
    note: str = Field(default='', max_length=2000)
    soil: Literal['dry', 'slightly_moist', 'moist', 'wet', 'not_sure'] | None = None
    amount_ml: float | None = Field(default=None, ge=0, le=100000)
    visual: Literal['great', 'different', 'unwell', 'not_sure'] | None = None
    @model_validator(mode='after')
    def meanings(self):
        if self.soil is not None and self.type != 'Soil check':
            raise ValueError('Soil condition belongs to Soil check.')
        if self.amount_ml is not None and self.type != 'Watered':
            raise ValueError('Water amount belongs to Watered.')
        if self.visual is not None and self.type != 'Observation':
            raise ValueError('Visual condition belongs to Observation.')
        return self

class DeviceIn(StrictModel):
    plant_id: str
    name: str = Field(min_length=1, max_length=120)

class CalibrationIn(StrictModel):
    dry: int = Field(ge=0, le=4095)
    wet: int = Field(ge=0, le=4095)
    @model_validator(mode='after')
    def order(self):
        if self.dry <= self.wet:
            raise ValueError('Dry must be greater than wet.')
        return self

class SensorIn(Timed):
    message_id: str = Field(min_length=1, max_length=100)
    raw_adc: int = Field(ge=0, le=4095)
    calibration_version: int = Field(ge=1)
    signal_quality: float = Field(default=1, ge=0, le=1)

class DemoSensorIn(CalibrationIn):
    id: str = Field(min_length=1, max_length=80)
    plantId: str
    name: str = Field(min_length=1, max_length=120)
    moisture: float = Field(ge=0, le=100)
    observedAt: datetime
    source: Literal['SENSOR']
    demo: Literal[True]

class ProfileIn(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    onboarded: bool
    reminders: bool
    caregiver: CaregiverProfile | None = None

class DemoPlanIn(StrictModel):
    plan: Literal['Free', 'Seed', 'Grow', 'Thrive']
    annual: bool
