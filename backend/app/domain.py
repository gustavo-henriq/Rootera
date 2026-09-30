"""Time helpers and the evidence record the guidance reads.

The Plant Twin is the guidance (guidance.py) projected from these records: what the
caregiver did or observed, never an invented percentage.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

# Records accepted up to 5 minutes ahead (a phone clock slightly fast) count as now.
CLOCK_SKEW = timedelta(minutes=5)

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)

@dataclass(frozen=True)
class Evidence:
    """One care record: a watering, a soil check or an observation, as the caregiver gave it."""
    id: str
    source: str
    kind: str
    value: dict
    at: str
    confidence: float
