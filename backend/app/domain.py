"""Deterministic, explainable Plant Twin v1. No invented ML or sensor readings."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

# Records accepted up to 5 minutes ahead (a phone clock slightly fast) count as now.
CLOCK_SKEW = timedelta(minutes=5)

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)

def normalize_adc(raw: int, dry: int, wet: int) -> float:
    if not 0 <= wet < dry <= 4095 or not 0 <= raw <= 4095:
        raise ValueError('ADC must be 0-4095 and dry must be greater than wet.')
    return round(max(0, min(100, (dry - raw) / (dry - wet) * 100)), 2)

@dataclass(frozen=True)
class Evidence:
    id: str
    source: str
    kind: str
    value: dict
    at: str
    confidence: float
    demo: bool = False

class PlantTwinEngine:
    """Project immutable evidence into separate measured, reported and inferred state.

    Soil percentages are NEVER manufactured from watering or free text. Qualitative
    observations are context, not percentages. Readings expire after 6h, reports
    after 24h. Demo device evidence never contributes to the actual Twin.
    """
    version = 'rules-1.0.0'

    def project(self, plant_id: str, evidence: list[Evidence], now: datetime | None = None) -> dict:
        now = now or utcnow()
        # Each timestamp parsed once; the sort and the cut-off reuse it.
        timed = sorted(((parse_time(e.at), e) for e in evidence), key=lambda p: (p[0], p[1].id))
        ordered = [e for _, e in timed]
        eligible = [e for t, e in timed if not e.demo and t <= now + CLOCK_SKEW]
        sensor = next((e for e in reversed(eligible) if e.source == 'SENSOR' and e.confidence >= .5), None)
        soil = next((e for e in reversed(eligible) if e.source == 'USER' and e.kind == 'Soil check' and e.value.get('soil') in ('dry', 'slightly_moist', 'moist', 'wet')), None)
        watered = next((e for e in reversed(eligible) if e.source == 'USER' and e.kind == 'Watered'), None)
        fresh_sensor = sensor is not None and (now - parse_time(sensor.at)).total_seconds() <= 21600
        fresh_soil = soil is not None and (now - parse_time(soil.at)).total_seconds() <= 86400
        # A report predating a subsequent watering no longer describes current soil.
        if soil and watered and parse_time(watered.at) > parse_time(soil.at):
            fresh_soil = False
        sensor_precedes_watering = bool(sensor and watered and parse_time(watered.at) > parse_time(sensor.at))
        measured = None if sensor is None else {'soil_moisture_percent': sensor.value['moisture'], 'observed_at': sensor.at, 'observation_id': sensor.id, 'source': 'SENSOR', 'stale': not fresh_sensor, 'predates_watering': sensor_precedes_watering, 'confidence': sensor.confidence}
        reported = None if soil is None else {'soil_condition': soil.value['soil'], 'observed_at': soil.at, 'observation_id': soil.id, 'source': 'USER', 'stale': not fresh_soil, 'confidence': soil.confidence}
        usable_sensor = fresh_sensor and not sensor_precedes_watering
        conflicts = []
        if usable_sensor and fresh_soil and abs((parse_time(sensor.at) - parse_time(soil.at)).total_seconds()) <= 7200:
            if (soil.value['soil'] == 'dry' and sensor.value['moisture'] >= 55) or (soil.value['soil'] == 'wet' and sensor.value['moisture'] <= 25):
                conflicts.append({'type': 'ObservationConflictDetected', 'evidence_ids': [sensor.id, soil.id], 'reason': 'Your soil report differs from the sensor. Check placement and calibration.'})
        status, reason, confidence = 'unknown', 'Add a recent soil check or a real sensor reading.', 0.0
        ids = []
        if conflicts:
            status, reason, confidence = 'check_sensor', conflicts[0]['reason'], .4
            ids = conflicts[0]['evidence_ids']
        elif usable_sensor:
            status = 'check_soil' if sensor.value['moisture'] < 25 else 'observed'
            reason = 'Low calibrated moisture. Check soil before watering.' if status == 'check_soil' else 'Recent calibrated moisture is available; this is not a diagnosis.'
            confidence = round(sensor.confidence * .9, 2)
            ids = [sensor.id]
        elif fresh_soil:
            status = 'check_soil' if soil.value['soil'] == 'dry' else 'observed'
            reason, confidence, ids = f"You reported {soil.value['soil'].replace('_', ' ')} soil. No sensor percentage was inferred.", .6, [soil.id]
        elif watered and (now - parse_time(watered.at)).total_seconds() < 86400:
            status, reason, confidence, ids = 'care_logged', 'Watering recorded. Current soil moisture is still unknown.', .5, [watered.id]
        return {'plant_id': plant_id, 'engine_version': self.version, 'evaluated_at': now.isoformat(),
                'measured': measured, 'reported': reported, 'last_watered_at': watered.at if watered else None,
                'inferred': {'status': status, 'reason': reason, 'confidence': confidence, 'evidence_ids': ids},
                'conflicts': conflicts, 'evidence_count': len(eligible), 'demo_evidence_count': sum(e.demo for e in ordered),
                'limitations': ['Rule-based baseline; not a trained predictive model.', 'Thresholds require validation for species, soil and hardware.']}
