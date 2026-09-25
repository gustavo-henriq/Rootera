from datetime import datetime, timedelta, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Experience = Literal['first', 'some', 'many']
Plan = Literal['Free', 'Plus']
PLAN_CAPACITY = {'Free': 3, 'Plus': None}
# Values written by earlier versions of the app remain readable.
LEGACY_EXPERIENCE = {'Just starting': 'first', 'I know the basics': 'some', 'Pretty experienced': 'many', 'Plant nerd': 'many'}
LEGACY_PLANS = {'Seed': 'Plus', 'Grow': 'Plus', 'Thrive': 'Plus'}


def normalize_plan(value: str | None) -> str:
    value = LEGACY_PLANS.get(value or 'Free', value or 'Free')
    return value if value in PLAN_CAPACITY else 'Free'


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class CaregiverProfile(StrictModel):
    experience: Experience = 'first'
    detail: Literal['Guided', 'Concise'] = 'Guided'
    plant_count: str | None = Field(default=None, max_length=20)  # legacy, no longer asked

    @field_validator('experience', mode='before')
    @classmethod
    def legacy(cls, v):
        return LEGACY_EXPERIENCE.get(v, v)


class EnvironmentModel(StrictModel):
    location: Literal['Indoors', 'Outdoors', 'Balcony / patio', 'Not sure'] = 'Not sure'
    near_window: Literal['Yes', 'No', 'Not sure'] = 'Not sure'


class PlantContext(StrictModel):
    """Context the caregiver declares. Every field is optional; 'Not sure' is a valid answer."""
    room: str = Field(default='Not sure', min_length=1, max_length=100)
    pot: str = Field(default='Not sure', min_length=1, max_length=100)
    light: str = Field(default='Not sure', min_length=1, max_length=120)
    time_with_owner: str = Field(default='Not sure', max_length=60)
    stage: Literal['Seedling', 'Young', 'Mature', 'Not sure'] = 'Not sure'
    environment: EnvironmentModel = Field(default_factory=EnvironmentModel)
    drainage: Literal['Yes', 'No', 'Not sure'] = 'Not sure'
    material: str = Field(default='Not sure', max_length=60)
    self_watering: Literal['Yes', 'No', 'Not sure'] = 'Not sure'
    substrate: str = Field(default="I don't know", max_length=100)


class PlantIn(PlantContext):
    id: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    name: str = Field(min_length=1, max_length=100)
    species: str = Field(min_length=1, max_length=160)
    kind: Literal['aloe', 'peace-lily', 'monstera', 'pothos', 'snake-plant', 'zz', 'pilea', 'cactus', 'other']
    photo: str | None = Field(default=None, max_length=2000)


class PlantUpdate(StrictModel):
    """Partial update of name, photo and context. Species and id are fixed."""
    name: str | None = Field(default=None, min_length=1, max_length=100)
    photo: str | None = Field(default=None, max_length=2000)
    room: str | None = Field(default=None, min_length=1, max_length=100)
    pot: str | None = Field(default=None, min_length=1, max_length=100)
    light: str | None = Field(default=None, min_length=1, max_length=120)
    time_with_owner: str | None = Field(default=None, max_length=60)
    stage: Literal['Seedling', 'Young', 'Mature', 'Not sure'] | None = None
    environment: EnvironmentModel | None = None
    drainage: Literal['Yes', 'No', 'Not sure'] | None = None
    material: str | None = Field(default=None, max_length=60)
    self_watering: Literal['Yes', 'No', 'Not sure'] | None = None
    substrate: str | None = Field(default=None, max_length=100)


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
        if self.type == 'Soil check' and self.soil is None:
            raise ValueError('A soil check needs a soil condition.')
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


NudgeKind = Literal['soil_check', 'pattern', 'leaves', 'weekly']


class NudgePrefs(StrictModel):
    """Which nudges the caregiver wants and when. Watering-related nudges use this time."""
    kinds: list[NudgeKind] = Field(default_factory=lambda: ['soil_check', 'pattern'], max_length=4)
    time: str = Field(default='08:00', pattern=r'^([01]\d|2[0-3]):[0-5]\d$')

    @field_validator('kinds')
    @classmethod
    def unique(cls, v):
        return list(dict.fromkeys(v))


class ProfileIn(StrictModel):
    name: str | None = Field(default=None, max_length=100)
    onboarded: bool | None = None
    reminders: bool | None = None
    caregiver: CaregiverProfile | None = None
    nudges: NudgePrefs | None = None


class DemoPlanIn(StrictModel):
    plan: Plan
    annual: bool = False

    @field_validator('plan', mode='before')
    @classmethod
    def legacy(cls, v):
        return LEGACY_PLANS.get(v, v)


class IdentifyIn(StrictModel):
    image_base64: str = Field(min_length=100, max_length=8_000_000)
    organ: Literal['auto', 'leaf', 'flower', 'fruit', 'bark'] = 'auto'
