from datetime import datetime, timedelta, timezone
from app.domain import Evidence
from app.guidance import SensorlessGuidance
from conftest import ALICE, plant_payload

NOW = datetime(2026, 9, 9, tzinfo=timezone.utc)
def e(id, kind, value, hours=0, source='USER'):
    return Evidence(id, source, kind, value, (NOW-timedelta(hours=hours)).isoformat(), .65)
def project(events, plant=None, caregiver=None):
    return SensorlessGuidance().project(plant or {}, caregiver or {}, events, NOW)

def test_no_fake_metrics_or_sensor_dependency():
    g=project([e('device','SoilMoistureMeasured',{'moisture':5},source='SENSOR')])
    assert g['state']=='NEW' and g['soil'] is None
    assert g['baseline_days'] is None and g['weather_connected'] is False

def test_dry_soil_uses_declared_pot_context():
    g=project([e('soil','Soil check',{'soil':'dry'})],{'drainage':'No','self_watering':'Yes'})
    assert 'drainage' in g['reason'] and 'reservoir' in g['reason']
    assert g['action']=='View plant'

def test_unknown_answer_does_not_reuse_old_soil_claim():
    g=project([e('old','Soil check',{'soil':'wet'},2),e('new','Soil check',{'soil':'not_sure'})])
    assert g['soil'] is None and g['action']=='Check soil'

def test_watering_invalidates_previous_report():
    g=project([e('soil','Soil check',{'soil':'dry'},2),e('water','Watered',{})])
    assert g['soil'] is None and g['title']=='Watering recorded'

def test_baseline_requires_separate_cycles():
    events=[]
    for i, hours in enumerate([240,160,80]):
        events += [e(f'w{i}','Watered',{},hours),e(f'd{i}','Soil check',{'soil':'dry'},hours-48)]
    assert project(events[:-2])['baseline_days'] is None
    g=project(events)
    assert g['baseline_days']==2 and g['completed_cycles']==3
    assert g['learning']=='Medium confidence'

def test_visual_check_is_not_a_diagnosis():
    g=project([e('visual','Observation',{'visual':'unwell'})])
    assert g['title']=='Let’s look at what changed' and g['state']=='LEARNING'

def test_new_context_and_visual_observation_persist(client):
    payload=plant_payload()
    payload.update(environment={'location':'Indoors','near_window':'Yes'},substrate='Dense / holds water',drainage='No',stage='Young')
    assert client.post('/v1/plants',json=payload,headers=ALICE).status_code==201
    profile={'name':'Maya','onboarded':True,'reminders':True,'caregiver':{'experience':'Plant nerd','plant_count':'4–10','detail':'Concise'}}
    assert client.patch('/v1/profile',json=profile,headers=ALICE).status_code==200
    observation={'id':'look','type':'Observation','visual':'different','observed_at':datetime.now(timezone.utc).isoformat()}
    assert client.post('/v1/plants/aloe-1/user-observations',json=observation,headers=ALICE).status_code==201
    garden=client.get('/v1/garden',headers=ALICE).json()
    assert garden['caregiver']['experience']=='Plant nerd'
    assert garden['plants'][0]['environment']['near_window']=='Yes'
    assert garden['events'][0]['visual']=='different'
    assert garden['twins']['aloe-1']['guidance']['visual']=='different'
    assert garden['twins']['aloe-1']['measured'] is None

def test_visual_field_cannot_be_saved_as_watering(planted):
    r=planted.post('/v1/plants/aloe-1/user-observations',headers=ALICE,json={'id':'invalid','type':'Watered','visual':'great','observed_at':datetime.now(timezone.utc).isoformat()})
    assert r.status_code==422


def test_fresh_soil_resolves_visual_check_prompt():
    g=project([e('visual','Observation',{'visual':'different'},1),e('soil','Soil check',{'soil':'dry'})])
    assert g['action']=='View plant'
    assert 'checks are saved' in g['reason']


def test_unknown_visual_clears_previous_claim():
    g=project([e('old','Observation',{'visual':'unwell'},1),e('new','Observation',{'visual':'not_sure'})])
    assert g['visual'] is None
    assert g['title']!='Let’s look at what changed'


def test_stale_visual_is_not_a_current_check():
    assert project([e('old','Observation',{'visual':'unwell'},25)])['visual'] is None


def test_concise_guidance_keeps_drainage_context():
    g=project([e('soil','Soil check',{'soil':'dry'})],{'drainage':'No','self_watering':'Yes'},{'detail':'Concise'})
    assert 'drainage' in g['reason'] and 'reservoir' in g['reason']


def test_watering_after_visual_change_does_not_repeat_check():
    g=project([e('visual','Observation',{'visual':'different'},1),e('water','Watered',{})])
    assert g['action']=='View plant'
    assert g['title']=='Watch how it responds'
