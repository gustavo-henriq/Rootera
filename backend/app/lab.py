"""Shipaton lab: a simulated plant ("MVP Shipaton") and a simulated caregiver, run day by
day through the REAL guidance engine, so a tester can see how Rootera adapts to a
watering method, to missed or extra waterings, and to the pot and place.

Two models, kept apart on purpose:
- The virtual plant (TRUTH): how fast each soil layer really dries after a watering, and
  how the leaves react to roots kept wet or dry for too long. Rootera never sees it.
- Rootera (guidance.py): sees only what the simulated caregiver records (layered soil
  checks, waterings, leaf notes), exactly as it would from a person.
The gap between the two is the point: the estimate starts general and moves toward this
plant as cycles come in.

Nothing is stored. Weather and photos are not simulated yet (see WEATHER, PHOTOS below);
the request accepts them so the app and this module keep their place.
"""
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone

from .domain import Evidence
from .guidance import SensorlessGuidance
from .soil import DECISIVE, summarize
from .species import notes_for

# Days after a thorough watering until each layer is dry, for a medium plastic pot with
# drainage, regular mix, bright indirect light, indoors. "top" is the surface (a fingertip),
# "middle" about 5 cm down (a finger), "bottom" the bottom of the pot (a skewer). By how deep
# the species dries (species.py `dryness`), calibrated so a caregiver who checks before
# watering ends up at the intervals extension services give (docs/calibracao-shipaton.md):
# - top (peace lily, fern, calathea): top inch dry, about weekly (SDSU Extension);
# - half (monstera, pothos, rubber plant): top 1-2 inches dry, every 7-14 days (UMN
#   Extension for monstera, Clemson HGIC for pothos);
# - full (aloe, snake plant, ZZ, cacti): dry through, every 2-3 weeks in the growing season
#   (Virginia Tech SPES-804: cacti and succulents once or twice a month).
# The virtual plant, not a rule of the app: Rootera never reads these numbers.
TRUTH_DAYS = {
    'top': {'top': 5.5, 'middle': 8.0, 'bottom': 11.0},
    'half': {'top': 4.5, 'middle': 9.0, 'bottom': 13.0},
    'full': {'top': 3.5, 'middle': 9.0, 'bottom': 16.0},
    'unknown': {'top': 4.5, 'middle': 9.0, 'bottom': 13.0},
}
# The physics of the pot and place, per layer (top, middle, bottom). Kept apart from the
# estimator's factors in forecast.py, so the lab is not grading the app against itself.
TRUTH_FACTORS = {
    ('pot', 'Small pot'): (.75, .7, .7),
    ('pot', 'Large pot'): (1.1, 1.3, 1.45),
    ('drainage', 'No'): (1.0, 1.35, 2.2),
    ('light', 'Direct sun'): (.7, .8, .85),
    ('light', 'Low light'): (1.4, 1.35, 1.3),
    ('light', 'Bright indirect light'): (.95, .95, .95),
}
# A layer is wet for this share of its drying time, moist until dry.
WET_SHARE = .3
# Leaves react to roots kept wet or dry too long:
# - wet: watering again before the species' layers dried, twice in a row (roots never get
#   air), or a pot without drainage whose bottom stays wet for over two weeks;
# - dry: the layers that matter stay dry for longer than the species tolerates.
THIRST_DAYS = {'top': 2, 'half': 4, 'full': 10, 'unknown': 4}
SOGGY_WATERINGS = 2
EARLY_SHARE = .7
SOGGY_BOTTOM_DAYS = 14
LEAVES_CHANGE_DAYS, LEAVES_UNWELL_DAYS = 7, 14
LEAF_NOTE_EVERY = 7
MAX_DAYS = 91
# Real weather for the lab: three months of daily ET0 from Open-Meteo's archive.
CLIMATES = {
    'sp_spring': (-23.55, -46.63, '2025-09-01', '2025-11-30'),   # São Paulo, spring: warming, ET0 3.7-4.3
    'poa_winter': (-30.03, -51.23, '2025-06-01', '2025-08-31'),  # Porto Alegre, winter: ET0 1.5-2.2
}
_climates: dict[str, list[float]] = {}
# How much the outdoor weather reaches the virtual plant's pot indoors (a house buffers heat
# and humidity, but not all of it). Kept apart from the engine's damping (forecast.py), so the
# lab does not grade Rootera against its own assumption.
TRUTH_WEATHER_WEIGHT = .6
REF_ET0 = 3.5


def climate_series(name: str) -> list[float] | None:
    """Daily ET0 for a named climate. The three months were fetched once from Open-Meteo's
    archive and are kept in app/data/climates.json, so the lab never depends on the network
    (a failed download once ran "winter" silently without its weather)."""
    if name not in CLIMATES:
        return None
    if not _climates:
        import json
        from pathlib import Path
        data = json.loads((Path(__file__).parent / 'data' / 'climates.json').read_text(encoding='utf-8'))
        _climates.update({k: [v for v in c['et0'] if v is not None] for k, c in data.items()})
    return _climates.get(name)


def speeds(series: list[float] | None, days: int) -> list[float]:
    """How fast the virtual pot dries each day, against a mild day (1.0)."""
    if not series:
        return [1.0] * (days + 2)
    out = [min(1.6, max(.6, 1 + TRUTH_WEATHER_WEIGHT * (v / REF_ET0 - 1))) for v in series]
    return (out + [out[-1]] * (days + 2))[:days + 2]


def effective(t0: float, t1: float, speed: list[float]) -> float:
    """Drying progress between two moments (in days), day by day at each day's speed."""
    total, t = 0.0, t0
    while t < t1:
        day = int(t)
        nxt = min(t1, day + 1)
        total += (nxt - t) * speed[min(day, len(speed) - 1)]
        t = nxt
    return total
# Not simulated yet. When a weather source is connected, hot and dry days will shorten the
# drying times (and cool, humid ones lengthen them); photos will record the leaves.
WEATHER = None
PHOTOS = None

METHODS = ('rootera', 'weekly', 'often', 'forgetful', 'manual')
EVERY = {'weekly': 7, 'often': 3, 'forgetful': 14}


@dataclass
class DayInput:
    water: bool | None = None       # None: the method decides
    layers: dict | None = None      # a check with these answers (overrides the plant)
    leaves: str | None = None       # a leaf note (overrides the plant)
    check: bool | None = None       # force a check (True) or skip it (False)


@dataclass
class LabRun:
    kind: str
    plant: dict
    method: str = 'rootera'
    days: int = 42
    check_every: int = 2
    pace: float = 1.0               # this plant vs a typical one (<1 dries faster)
    overrides: dict[int, DayInput] = field(default_factory=dict)
    lang: str = 'en'
    weather: list[float] | None = None   # daily ET0 (mm), from day 0


def layer_days(kind: str, plant: dict, pace: float) -> dict:
    dryness = notes_for(kind)['dryness']
    base = dict(TRUTH_DAYS.get(dryness, TRUTH_DAYS['unknown']))
    for (fieldname, value), mult in TRUTH_FACTORS.items():
        if plant.get(fieldname) == value:
            for i, k in enumerate(('top', 'middle', 'bottom')):
                base[k] *= mult[i]
    return {k: round(v * pace, 2) for k, v in base.items()}


def layers_at(since: float | None, days: dict) -> dict:
    """The plant's soil `since` days after its last watering (None: never watered = dry)."""
    if since is None:
        return {k: 'dry' for k in days}
    return {k: 'dry' if since >= d else 'wet' if since < d * WET_SHARE else 'moist' for k, d in days.items()}


def simulate(run: LabRun, start: datetime | None = None) -> dict:
    kind, plant = run.kind, {**run.plant, 'kind': run.kind}
    dryness = notes_for(kind)['dryness']
    decisive = DECISIVE.get(dryness, DECISIVE['unknown'])
    truth = layer_days(kind, plant, run.pace)
    dry_after = max(truth[k] for k in decisive)
    start = start or datetime.combine(datetime.now(timezone.utc).date(), time(0), tzinfo=timezone.utc)
    engine = SensorlessGuidance()
    evidence: list[Evidence] = []
    out_days = []
    last_water: float | None = None       # day number (fractional) of the last watering
    last_check = -99
    early = 0                             # waterings in a row before the plant was dry
    wet_streak = dry_streak = bottom_wet = 0
    leaves_state, last_note = 'great', -99
    guidance = None
    speed = speeds(run.weather, min(run.days, MAX_DAYS))
    real_cycles: list[float] = []   # how long each cycle really took to dry, under its weather
    for d in range(min(run.days, MAX_DAYS)):
        o = run.overrides.get(d, DayInput())
        at = lambda h, m=0: (start + timedelta(days=d, hours=h, minutes=m)).isoformat()
        since = None if last_water is None else effective(last_water, d + 9 / 24, speed)
        # What Rootera sees of the weather: the week around this day, and the days so far.
        if run.weather:
            week = run.weather[max(0, d - 7):d + 3]
            plant['weather'] = {'et0': round(sum(week) / len(week), 2), 'daily': {(start + timedelta(days=i)).date().isoformat(): v for i, v in enumerate(run.weather[:d + 3])}}
        soil = layers_at(since, truth)
        events = []
        # The morning check: by the method, or forced; the answers come from the plant unless typed in.
        due = run.method == 'rootera' and (guidance is None or guidance['action'] in ('check_soil', 'log_water') or d - last_check >= max(run.check_every, 3))
        due = due or (run.method != 'rootera' and d - last_check >= run.check_every)
        # Typed answers always make a check; otherwise the tester's choice, then the method.
        checked = True if o.layers is not None else o.check if o.check is not None else due
        if checked:
            layers = o.layers or soil
            evidence.append(Evidence(f'lab-c{d}', 'USER', 'Soil check', {'soil': summarize(layers, dryness), 'layers': layers, 'note': ''}, at(9), .65))
            events.append({'type': 'check', 'layers': layers, 'typed': o.layers is not None})
            last_check = d
        # Watering: the method decides unless the tester chose.
        if o.water is not None:
            water = o.water
        elif run.method == 'rootera':
            probe = engine.project(plant, {}, evidence, datetime.fromisoformat(at(9, 15)), run.lang) if checked else None
            water = bool(probe and probe['action'] == 'log_water')
        elif run.method in EVERY:
            water = d % EVERY[run.method] == 0
        else:
            water = False
        if water:
            # Early means well before the layers that matter dried (a day short is not soggy roots).
            early = early + 1 if since is not None and since < dry_after * EARLY_SHARE else 0
            evidence.append(Evidence(f'lab-w{d}', 'USER', 'Watered', {'note': '', 'amount_ml': None}, at(9, 30), .65))
            events.append({'type': 'water'})
            if last_water is not None and since is not None and since >= dry_after:
                real_cycles.append(_dried_at(last_water, dry_after, speed) - last_water)
            last_water = d + 9.5 / 24
        # How the plant is doing at the end of the day.
        since_eve = None if last_water is None else effective(last_water, d + 20 / 24, speed)
        eve = layers_at(since_eve, truth)
        bottom_wet = bottom_wet + 1 if eve['bottom'] != 'dry' else 0
        soggy = early >= SOGGY_WATERINGS or (plant.get('drainage') == 'No' and bottom_wet > SOGGY_BOTTOM_DAYS)
        wet_streak = wet_streak + 1 if soggy else 0
        dry_streak = dry_streak + 1 if all(eve[k] == 'dry' for k in decisive) else 0
        thirst = THIRST_DAYS.get(dryness, 4)
        state = 'great'
        if wet_streak >= LEAVES_UNWELL_DAYS or dry_streak >= thirst * 3:
            state = 'unwell'
        elif wet_streak >= LEAVES_CHANGE_DAYS or dry_streak >= thirst * 2:
            state = 'different'
        stress = 'wet' if soggy else 'dry' if dry_streak >= thirst * 2 else None
        # Leaf notes: when the tester types one, when the plant changes, and once a week.
        note = o.leaves or (state if state != leaves_state or d - last_note >= LEAF_NOTE_EVERY else None)
        if note:
            evidence.append(Evidence(f'lab-l{d}', 'USER', 'Observation', {'visual': note, 'note': ''}, at(10), .65))
            events.append({'type': 'leaves', 'visual': note, 'typed': o.leaves is not None})
            last_note = d
        leaves_state = state
        guidance = engine.project(plant, {}, evidence, datetime.fromisoformat(at(20)), run.lang)
        out_days.append({
            'day': d, 'date': (start + timedelta(days=d)).date().isoformat(),
            'soil': eve, 'events': events, 'leaves': state, 'stress': stress,
            'guidance': {k: guidance[k] for k in ('title', 'reason', 'action', 'tip', 'basis', 'state', 'forecast', 'baseline_days', 'completed_cycles', 'cycle_days', 'soil', 'soil_layers', 'last_watered_at')},
        })
    last = guidance or {}
    window = last.get('forecast') or {}
    learned = last.get('baseline_days')
    return {
        'plant': {'name': 'MVP Shipaton', 'kind': kind, 'dryness': dryness, 'decisive': list(decisive)},
        'truth': {'layer_days': truth, 'dry_after_days': round(dry_after, 1), 'real_cycle_days': [round(x, 1) for x in real_cycles]},
        'days': out_days,
        'summary': {
            'waterings': sum(1 for x in out_days for e in x['events'] if e['type'] == 'water'),
            'checks': sum(1 for x in out_days for e in x['events'] if e['type'] == 'check'),
            'wet_days': sum(1 for x in out_days if x['stress'] == 'wet'),
            'dry_days': sum(1 for x in out_days if x['stress'] == 'dry'),
            'unwell_days': sum(1 for x in out_days if x['leaves'] == 'unwell'),
            'learned_days': learned, 'window': [window.get('low_days'), window.get('high_days')] if window else None,
            'window_source': window.get('source'), 'cycles': last.get('completed_cycles', 0),
            # Against how long the cycles really took (with the weather), not the mild-day figure.
            'error_days': round(abs(learned - (sum(real_cycles[-6:]) / len(real_cycles[-6:]) if real_cycles else dry_after)), 1) if learned is not None else None,
        },
        'integrations': {'weather': WEATHER is not None, 'photos': PHOTOS is not None},
    }



def _dried_at(t0: float, target: float, speed: list[float]) -> float:
    """The moment (in days) when drying progress since t0 reaches `target`."""
    t, done = t0, 0.0
    while done < target and t < len(speed):
        day = int(t)
        step = min(1.0, day + 1 - t)
        rate = speed[min(day, len(speed) - 1)]
        if done + step * rate >= target:
            return t + (target - done) / rate
        done += step * rate
        t += step
    return t
