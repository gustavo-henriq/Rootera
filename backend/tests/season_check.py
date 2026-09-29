"""Three months, every species, three climates: does Rootera end up where the sources say?

Run: python tests/season_check.py [truth_weight] [engine_weight]
- truth_weight: how much the outdoor weather reaches the virtual pot indoors (lab.py)
- engine_weight: how much Rootera adjusts indoor windows for the weather (forecast.py)

Climates are real (Open-Meteo archive): São Paulo in spring (ET0 3.7-4.3 mm/day) and
Porto Alegre in winter (1.5-2.2), plus no weather at all. For each run: the mean interval
between waterings, how long cycles really took, what Rootera learned, and the days the
plant spent soggy or thirsty. Reference intervals (docs/calibracao-shipaton.md):
top about weekly in the growing season; half 7-14 days; full 14-21 days, about monthly
in winter; everything less often in winter.
"""
import sys
from pathlib import Path
from statistics import mean

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import forecast, lab  # noqa: E402
from app.lab import LabRun, climate_series, simulate  # noqa: E402
from app.species import SPECIES_NOTES  # noqa: E402

if len(sys.argv) > 1:
    lab.TRUTH_WEATHER_WEIGHT = float(sys.argv[1])
if len(sys.argv) > 2:
    forecast.WEATHER_WEIGHT['indoors'] = float(sys.argv[2])

HOME = {'pot': 'Medium pot', 'drainage': 'Yes', 'light': 'Bright indirect light', 'environment': {'location': 'Indoors'}}
CLIMATES = {'none': None, 'sp_spring': climate_series('sp_spring'), 'poa_winter': climate_series('poa_winter')}
REFERENCE = {'top': {'none': (5, 8), 'sp_spring': (4, 8), 'poa_winter': (7, 12)},
             'half': {'none': (7, 14), 'sp_spring': (7, 12), 'poa_winter': (10, 18)},
             'full': {'none': (14, 21), 'sp_spring': (12, 21), 'poa_winter': (18, 32)}}

rows, inside, errors, stress = [], 0, [], 0
for kind in SPECIES_NOTES:
    for climate, series in CLIMATES.items():
        r = simulate(LabRun(kind=kind, plant=HOME, method='rootera', days=91, weather=series))
        s = r['summary']
        waters = [d['day'] for d in r['days'] if any(e['type'] == 'water' for e in d['events'])]
        gaps = [b - a for a, b in zip(waters, waters[1:])]
        every = round(mean(gaps), 1) if gaps else None
        real = r['truth']['real_cycle_days']
        lo, hi = REFERENCE[r['plant']['dryness']][climate]
        ok = every is not None and lo <= every <= hi
        inside += ok
        if s['error_days'] is not None:
            errors.append(s['error_days'])
        stress += s['wet_days'] + s['dry_days']
        rows.append(f"{kind:12} {r['plant']['dryness']:4} {climate:10} every {str(every):5} d  ref {lo:>2}-{hi:<2} {'ok ' if ok else 'OUT'} | real {round(mean(real), 1) if real else '-':>4} learned {str(s['learned_days']):5} err {str(s['error_days']):4} | soggy {s['wet_days']:2} thirsty {s['dry_days']:2}")

print('\n'.join(rows))
print(f"\nwithin the reference interval: {inside}/{len(rows)}   mean learning error: {round(mean(errors), 2)} d   stress days: {stress}")
