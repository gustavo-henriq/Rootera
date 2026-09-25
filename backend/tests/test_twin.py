"""Behavioral contract for measured, reported and inferred plant state."""
from datetime import datetime, timedelta, timezone

import pytest

from app.domain import Evidence, PlantTwinEngine, normalize_adc


NOW = datetime(2026, 8, 1, 12, tzinfo=timezone.utc)


def evidence(id, source, kind, value, *, hours=0, confidence=1, demo=False):
    return Evidence(id, source, kind, value, (NOW - timedelta(hours=hours)).isoformat(), confidence, demo)


def project(*events):
    return PlantTwinEngine().project('aloe-1', list(events), now=NOW)


def sensor(id='sensor-1', moisture=70, **kwargs):
    return evidence(id, 'SENSOR', 'SoilMoistureMeasured', {'moisture': moisture}, **kwargs)


def report(id='report-1', soil='dry', **kwargs):
    return evidence(id, 'USER', 'Soil check', {'soil': soil}, **kwargs)


def watering(**kwargs):
    return evidence('watering-1', 'USER', 'Watered', {'amount_ml': 250}, **kwargs)


def test_new_twin_does_not_invent_health_or_moisture():
    twin = project()
    assert twin['measured'] is None
    assert twin['reported'] is None
    assert twin['inferred']['status'] == 'unknown'
    assert twin['inferred']['confidence'] == 0


def test_watering_is_a_care_event_not_a_sensor_reading():
    twin = project(watering())
    assert twin['measured'] is None
    assert twin['reported'] is None
    assert twin['last_watered_at'] == NOW.isoformat()
    assert twin['inferred']['status'] == 'care_logged'
    assert twin['inferred']['evidence_ids'] == ['watering-1']


def test_qualitative_report_never_becomes_a_percentage():
    twin = project(report(soil='moist'))
    assert twin['measured'] is None
    assert twin['reported']['source'] == 'USER'
    assert twin['reported']['soil_condition'] == 'moist'
    assert 'soil_moisture_percent' not in twin['reported']
    assert twin['inferred']['status'] == 'observed'


def test_disagreeing_sources_are_retained_with_explicit_conflict():
    twin = project(sensor(), report())
    assert twin['measured']['soil_moisture_percent'] == 70
    assert twin['measured']['source'] == 'SENSOR'
    assert twin['reported']['soil_condition'] == 'dry'
    assert twin['reported']['source'] == 'USER'
    assert twin['inferred']['status'] == 'check_sensor'
    assert set(twin['conflicts'][0]['evidence_ids']) == {'sensor-1', 'report-1'}


def test_sensor_staleness_preserves_history_without_current_advice():
    twin = project(sensor(moisture=5, hours=7))
    assert twin['measured']['soil_moisture_percent'] == 5
    assert twin['measured']['stale'] is True
    assert twin['inferred']['status'] == 'unknown'


def test_stale_user_report_is_not_current_soil_evidence():
    twin = project(report(hours=25))
    assert twin['reported']['stale'] is True
    assert twin['inferred']['status'] == 'unknown'


def test_out_of_order_delivery_uses_observation_time():
    older = sensor('old', 5, hours=2)
    newer = sensor('new', 65, hours=1)
    assert project(newer, older) == project(older, newer)
    assert project(newer, older)['measured']['observation_id'] == 'new'


def test_demo_data_never_contributes_to_actual_twin():
    twin = project(sensor(demo=True), report())
    assert twin['measured'] is None
    assert twin['inferred']['evidence_ids'] == ['report-1']
    assert twin['conflicts'] == []
    assert twin['evidence_count'] == 1
    assert twin['demo_evidence_count'] == 1


def test_future_evidence_does_not_enter_current_state():
    twin = project(sensor(hours=-1), report(hours=-1))
    assert twin['measured'] is None
    assert twin['reported'] is None
    assert twin['evidence_count'] == 0


def test_low_quality_sensor_is_not_used_as_a_measurement():
    twin = project(sensor('good', 60, hours=1), sensor('bad', 0, confidence=.1))
    assert twin['measured']['observation_id'] == 'good'
    assert twin['inferred']['status'] == 'observed'


def test_watering_invalidates_earlier_soil_state_without_changing_measurement():
    twin = project(sensor(moisture=5, hours=2), report(hours=1), watering())
    assert twin['measured']['soil_moisture_percent'] == 5
    assert twin['measured']['predates_watering'] is True
    assert twin['reported']['stale'] is True
    assert twin['conflicts'] == []
    assert twin['inferred']['status'] == 'care_logged'


def test_new_measurement_after_watering_restores_measured_state():
    twin = project(watering(hours=2), sensor(moisture=60, hours=1))
    assert twin['measured']['predates_watering'] is False
    assert twin['inferred']['status'] == 'observed'


@pytest.mark.parametrize('raw,expected', [(3000, 0), (1000, 100), (2000, 50), (4095, 0), (0, 100)])
def test_adc_calibration_and_clamping(raw, expected):
    assert normalize_adc(raw, 3000, 1000) == expected


@pytest.mark.parametrize('raw,dry,wet', [(-1, 3000, 1000), (4096, 3000, 1000), (2000, 1000, 3000), (2000, 1000, 1000), (2000, 4096, 1000)])
def test_invalid_calibration_cannot_generate_percentages(raw, dry, wet):
    with pytest.raises(ValueError):
        normalize_adc(raw, dry, wet)
