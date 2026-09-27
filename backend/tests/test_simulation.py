"""Guards the measured behaviour of the guidance (tests/simulate.py) against regressions.

Four months of a caregiver who does what the app says. Before the review (2026-09-27) a
peace lily sat dry about 25 of 120 days and an undeclared fast-drying monstera about 52;
the app only ever asked on the day it expected dryness and so never learned a shorter cycle.
"""
import pytest

from simulate import run

CASES = [
    # (plant, true drying days, max dry days in 120, min share of learned windows containing it)
    ({'kind': 'peace-lily'}, 4, 6, .6),
    ({'kind': 'monstera'}, 10, 4, .5),
    ({'kind': 'monstera'}, 4, 8, .6),   # small pot in sun, not declared: the estimate is wrong
    ({'kind': 'monstera'}, 20, 6, .4),  # winter
    ({'kind': 'cactus'}, 21, 8, .5),
    ({'kind': 'other'}, 6, 4, .3),
]


@pytest.mark.parametrize('plant,days,max_dry,min_hits', CASES)
def test_plants_are_not_left_dry(plant, days, max_dry, min_hits):
    rows = [run(plant, days, seed=s) for s in range(4)]
    dry = sum(r['dry_days'] for r in rows) / len(rows)
    hits = [r['window_hits'] for r in rows if r['window_hits'] is not None]
    assert dry <= max_dry, dry
    assert hits and sum(hits) / len(hits) >= min_hits, hits


def test_checks_are_not_asked_for_every_day():
    # A slow plant: most days rest; the app does not turn into a daily chore.
    rows = [run({'kind': 'monstera'}, 20, seed=s) for s in range(4)]
    assert sum(r['checks'] for r in rows) / len(rows) <= 45
