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
# However many factors stack up, the estimate stays within these bounds of the start window.
MIN_SCALE, MAX_SCALE = .6, 1.6
FULL_TRUST_CYCLES = 3


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


def drying_window(plant: dict, dryness: str | None, cycle_hours: list[float], last_water_at: str | None):
    # A reservoir keeps feeding the soil from below, so surface dryness says little about timing.
    if plant.get('self_watering') == 'Yes':
        return None
    days = [h / 24 for h in cycle_hours]
    prior = estimate(plant, dryness)
    factors: list[str] = []
    if len(days) >= FULL_TRUST_CYCLES:
        low, high = _own_window(days)
        source = 'cycles'
    elif days and prior:
        weight = len(days) / FULL_TRUST_CYCLES
        own_low, own_high = _own_window(days)
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
    # Whole days, to the nearest: 4.96 days reads as 5, not 4.
    low_days = max(1, round(low))
    high_days = max(low_days, round(high))
    out = {'source': source, 'low_days': low_days, 'high_days': high_days, 'cycles': len(days), 'factors': factors,
           'check_from': None, 'dry_by': None}
    if last_water_at:
        start = parse_time(last_water_at)
        out['check_from'] = (start + timedelta(days=low_days)).isoformat()
        out['dry_by'] = (start + timedelta(days=high_days)).isoformat()
    return out
