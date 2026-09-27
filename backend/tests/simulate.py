"""Simulated caregivers following the app for months, to measure the guidance, not just test it.

A plant truly dries in D days (with day-to-day noise). Each morning the caregiver opens the
app and does what it says: a soil check when asked (reporting honestly what the soil is),
water when the soil was found dry. Some caregivers also check on their own now and then;
some skip days. We measure:
- dry_days: days that ended with the soil dry and not watered (the harm to avoid);
- wasted_checks: checks asked for that found the soil still moist (the annoyance);
- the window's accuracy once learned: does it contain the true D?

Run: .venv/Scripts/python.exe tests/simulate.py
"""
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.domain import Evidence  # noqa: E402
from app.guidance import SensorlessGuidance  # noqa: E402

START = datetime(2026, 3, 1, 8, tzinfo=timezone.utc)


def soil_at(age_days, D):
    f = age_days / D
    return 'dry' if f >= 1 else 'slightly_moist' if f >= .75 else 'moist' if f >= .2 else 'wet'


def run(plant, true_days, days=120, self_check=0.0, skip=0.0, noise=.15, seed=0):
    rng = random.Random(seed)
    events, n = [], 0
    last_water = START - timedelta(days=rng.uniform(0, true_days))  # arrives partly dry
    D = true_days * rng.uniform(1 - noise, 1 + noise)
    dry_days = wasted = waterings = checks = 0
    windows = []

    def add(kind, at, **value):
        nonlocal n
        n += 1
        events.append(Evidence(f'e{n}', 'USER', kind, {'note': '', **value}, at.isoformat(), .65))

    for day in range(days):
        now = START + timedelta(days=day, hours=rng.uniform(0, 3))
        age = (now - last_water).total_seconds() / 86400
        if rng.random() < skip:
            if age >= D:
                dry_days += 1
            continue
        g = SensorlessGuidance().project(plant, {'detail': 'Guided'}, events, now)
        if g['forecast'] and g['forecast']['source'] == 'cycles':
            windows.append((g['forecast']['low_days'], g['forecast']['high_days'], D))
        wants_check = g['action'] == 'check_soil' or rng.random() < self_check
        if g['action'] == 'log_water':
            add('Watered', now)
            last_water, waterings = now, waterings + 1
            D = true_days * rng.uniform(1 - noise, 1 + noise)
        elif wants_check:
            checks += 1
            state = soil_at(age, D)
            add('Soil check', now, soil=state)
            if state != 'dry' and g['action'] == 'check_soil':
                wasted += 1
            if state == 'dry':  # the app now says to water; the caregiver does it right away
                g2 = SensorlessGuidance().project(plant, {'detail': 'Guided'}, events, now + timedelta(minutes=1))
                if g2['action'] == 'log_water':
                    add('Watered', now + timedelta(minutes=2))
                    last_water, waterings = now + timedelta(minutes=2), waterings + 1
                    D = true_days * rng.uniform(1 - noise, 1 + noise)
        # Still dry at the end of the day, with no watering: a day the plant waited.
        if (now - last_water).total_seconds() / 86400 >= D and last_water < now - timedelta(hours=1):
            dry_days += 1
    learned = windows[-30:]
    contains = sum(lo - .5 <= d <= hi + .5 for lo, hi, d in learned) / len(learned) if learned else None
    return {'dry_days': dry_days, 'wasted_checks': wasted, 'checks': checks, 'waterings': waterings, 'window_hits': contains}


SCENARIOS = [
    ('monstera as expected (D=10)', {'kind': 'monstera'}, 10),
    ('monstera, small pot in sun, undeclared (D=4)', {'kind': 'monstera'}, 4),
    ('monstera, winter, slow (D=20)', {'kind': 'monstera'}, 20),
    ('peace lily (D=4)', {'kind': 'peace-lily'}, 4),
    ('cactus (D=21)', {'kind': 'cactus'}, 21),
    ('cactus in terracotta, declared (D=12)', {'kind': 'cactus', 'material': 'Terracotta'}, 12),
    ('plant added by name (D=6)', {'kind': 'other'}, 6),
    ('self-watering pot (D=9)', {'kind': 'pothos', 'self_watering': 'Yes'}, 9),
]

if __name__ == '__main__':
    print(f"{'scenario':48} {'dry days':>9} {'wasted':>7} {'checks':>7} {'waters':>7} {'window ok':>10}")
    for name, plant, D in SCENARIOS:
        rows = [run(plant, D, seed=s) for s in range(8)]
        avg = lambda k: sum(r[k] for r in rows) / len(rows)
        hits = [r['window_hits'] for r in rows if r['window_hits'] is not None]
        print(f"{name:48} {avg('dry_days'):9.1f} {avg('wasted_checks'):7.1f} {avg('checks'):7.1f} {avg('waterings'):7.1f} {(sum(hits) / len(hits) if hits else float('nan')):10.0%}")
