"""Drying window: roughly how many days after a watering this plant's soil is found dry.

Two sources, always labelled:
- `cycles`: the caregiver's own records. A cycle is a watering followed by the first
  dry soil check; its length depends on how often they check, so it is a window, not a
  measured drying time.
- `estimate`: a general starting point from how deep the species likes to dry, adjusted
  by the pot, soil, light and place the caregiver declared. It describes plants like this
  one in general, never this plant. It gives way to the caregiver's own cycles: one or two
  cycles are blended in (`blend`), and from three on only their own records count.

Before a pattern exists (three cycles), guidance.py uses the window to decide between
"probably not dry yet" and "around when it usually dries", so a plant is not flagged for
a check every day right after a watering. From three cycles on, the pattern rule decides.
"""
from datetime import timedelta
from math import floor
from statistics import median, quantiles

from .domain import parse_time

# General starting windows in days, by how deep the species likes to dry before watering
# (species.py `dryness`), for indoor pots in the growing season. Sources:
# - Virginia Tech Extension, "Properly Watering Container Houseplants" (SPES-804):
#   cacti and succulents "once or twice a month" -> full: 14 to 30 days; tropical
#   houseplants "sometimes once or twice a week" -> top: 3 to 7 days.
#   https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-804.html
# - half (dry about a third of the way down): between the two, 7 to 14 days. This one is
#   interpolated, not quoted.
# All sources say the finger test overrides any calendar, which is how the app uses it.
START_WINDOW = {'top': (3, 7), 'half': (7, 14), 'full': (14, 30)}

# Declared context that makes soil dry faster (<1) or slower (>1). Each is a named factor
# so the app can say what the estimate was adjusted for. The direction of every factor is
# from extension sources: small pots, terra cotta, coarse mixes and more light dry the
# mix faster; larger pots and fine mixes hold water longer (Virginia Tech SPES-804 above;
# Colorado State Extension PlantTalk 1315,
# https://planttalk.colostate.edu/topics/houseplants/1315-houseplants-containers/).
# The SIZE of each factor is not given by those sources and is a conservative choice:
# growers report terra cotta drying up to about twice as fast as plastic, used here as .75.
FACTORS = {
    'small_pot': ('pot', 'Small pot', .8),
    'large_pot': ('pot', 'Large pot', 1.2),
    'terracotta': ('material', 'Terracotta', .75),
    'no_drainage': ('drainage', 'No', 1.2),
    'chunky_mix': ('substrate', 'Very draining / chunky', .85),
    'dense_mix': ('substrate', 'Dense / holds water', 1.2),
    'direct_sun': ('light', 'Direct sun', .8),
    'bright_light': ('light', 'Bright indirect light', .9),
    'low_light': ('light', 'Low light', 1.25),
    'outdoors': ('location', 'Outdoors', .85),
}
# The week's weather (integrations/weather.py): evapotranspiration against a mild growing-
# season day (FAO-56 reference, about 3.5 mm/day in temperate summers). Outdoors a pot follows
# the weather almost fully; indoors the effect is damped (the house buffers heat and
# humidity). The adjustment is named, like every factor, and bounded.
WEATHER_REF_ET0 = 3.5
WEATHER_WEIGHT = {'indoors': .3, 'outdoors': .9}
WEATHER_BOUNDS = (.8, 1.25)


def cycles_et0(weather: dict, spans: list) -> float | None:
    """The mean ET0 during the learned cycles (each day of each cycle), when known."""
    daily = weather.get('daily') or {}
    values = []
    for start, days in spans:
        for i in range(max(1, round(days))):
            v = daily.get((start + timedelta(days=i)).date().isoformat())
            if v is not None:
                values.append(v)
    return sum(values) / len(values) if values else None


def weather_factor(plant: dict, own_weight: float = 0.0, spans: list | None = None) -> tuple[str | None, float]:
    """This week against the weather the window was built on: a mild reference day for the
    species estimate, and the weather the plant's own cycles actually had (they already
    carry it; comparing them with the reference again would count the weather twice)."""
    w = plant.get('weather')
    if not w or not w.get('et0'):
        return None, 1.0
    outdoors = (plant.get('environment') or {}).get('location') == 'Outdoors'
    learned = cycles_et0(w, spans or []) if own_weight else None
    ref = WEATHER_REF_ET0 if learned is None else (1 - own_weight) * WEATHER_REF_ET0 + own_weight * learned
    ratio = ref / max(.5, w['et0'])
    mult = 1 + WEATHER_WEIGHT['outdoors' if outdoors else 'indoors'] * (ratio - 1)
    mult = min(WEATHER_BOUNDS[1], max(WEATHER_BOUNDS[0], mult))
    if abs(mult - 1) < .05:
        return None, 1.0
    return ('warm_dry_week' if mult < 1 else 'cool_humid_week'), mult


# However many factors stack up, the estimate stays within these bounds of the start window.
MIN_SCALE, MAX_SCALE = .6, 1.6
FULL_TRUST_CYCLES = 3
# How much the plant's own cycles weigh against the species estimate before the pattern:
# the first cycle is still an observation (Rootera is analysing the plant); from the second,
# the window leans toward this plant; from the third, it is this plant's alone.
BLEND_WEIGHT = {1: .2, 2: .6}
# Unless the plant dries sooner than the estimate: then its own cycles are believed quickly,
# because trusting a too-long estimate leaves the plant dry, while a too-short one only
# costs an extra check.
FAST_WEIGHT = {1: .5, 2: .8}
# A general estimate is a guess about plants like this one, so the first check is suggested
# before its window opens: finding the soil still moist costs a check, finding it dry for
# days costs the plant. The share grows to 1 as the caregiver's own cycles come in.
ESTIMATE_FIRST_CHECK = .6


def _round(x: float) -> int:
    """Half up (4.5 -> 5); Python's round() goes to the even number."""
    return floor(x + .5)


def _declared(plant: dict, field: str):
    if field == 'location':
        return (plant.get('environment') or {}).get('location')
    return plant.get(field)


def estimate(plant: dict, dryness: str | None):
    """(low, high, factor keys) from the species and declared context, or None."""
    start = START_WINDOW.get(dryness or '')
    if start is None:
        return None
    used, scale = [], 1.0
    for key, (field, value, factor) in FACTORS.items():
        if _declared(plant, field) == value:
            used.append(key)
            scale *= factor
    scale = min(MAX_SCALE, max(MIN_SCALE, scale))
    return start[0] * scale, start[1] * scale, used


def _typical(days: list[float]) -> list[float]:
    """Cycles without the odd ones out: a check forgotten for weeks makes one cycle look
    far longer than the plant needed. Kept when within half to twice the median."""
    if len(days) < 3:
        return days
    mid = median(days)
    kept = [d for d in days if mid / 2 <= d <= mid * 2]
    return kept if len(kept) >= 2 else days


def _own_window(days: list[float]):
    """Middle half of the caregiver's typical cycles; with few cycles, all of them."""
    days = _typical(days)
    if len(days) >= 5:
        q = quantiles(days, n=4, method='inclusive')
        return q[0], q[2]
    return min(days), max(days)


def drying_window(plant: dict, dryness: str | None, cycle_hours: list[float], last_water_at: str | None, spans: list | None = None):
    # A reservoir keeps feeding the soil from below, so surface dryness says little about timing.
    if plant.get('self_watering') == 'Yes':
        return None
    days = [h / 24 for h in cycle_hours]
    weight = 0.0
    prior = estimate(plant, dryness)
    factors: list[str] = []
    if len(days) >= FULL_TRUST_CYCLES:
        low, high = _own_window(days)
        source = 'cycles'
    elif days and prior:
        own_low, own_high = _own_window(days)
        weight = (FAST_WEIGHT if own_low < (prior[0] + prior[1]) / 2 else BLEND_WEIGHT).get(len(days), 1.0)
        low = (1 - weight) * prior[0] + weight * own_low
        high = (1 - weight) * prior[1] + weight * own_high
        source, factors = 'blend', prior[2]
    elif days:
        # No species reference (a plant added by name): only its own cycles, however few.
        low, high = _own_window(days)
        source = 'cycles'
    elif prior:
        low, high = prior[0], prior[1]
        source, factors = 'estimate', prior[2]
    else:
        return None
    # This week's weather, when the caregiver turned it on.
    own = 1.0 if source == 'cycles' else weight if source == 'blend' else 0.0
    key, mult = weather_factor(plant, own, spans)
    if key:
        low, high = low * mult, high * mult
        factors = [*factors, key]
    # Whole days, to the nearest: 4.96 days reads as 5, not 4.
    low_days = max(1, _round(low))
    # Checks come a day apart at best, so a window is never narrower than a day ("4-4 days"
    # would claim a precision the records cannot have).
    high_days = max(low_days + 1, _round(high))
    # The first check comes as early as the weight given to the plant's own cycles allows.
    trust = 1.0 if source == 'cycles' else weight if source == 'blend' else 0.0
    check_after = max(1, _round(low_days * (ESTIMATE_FIRST_CHECK + (1 - ESTIMATE_FIRST_CHECK) * trust)))
    out = {'source': source, 'low_days': low_days, 'high_days': high_days, 'check_after_days': check_after,
           'cycles': len(days), 'factors': factors, 'check_from': None, 'dry_by': None}
    if last_water_at:
        start = parse_time(last_water_at)
        out['check_from'] = (start + timedelta(days=check_after)).isoformat()
        out['dry_by'] = (start + timedelta(days=high_days)).isoformat()
    return out
