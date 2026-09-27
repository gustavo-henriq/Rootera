"""Drying window: a general estimate adjusted by declared context, giving way to the caregiver's own cycles."""
from app.forecast import START_WINDOW, drying_window, estimate
from conftest import ALICE
from test_guidance import NOW, e, project


def cycles(*days, start=400):
    """Waterings every 100 h, each followed by a dry check `days` later."""
    events = []
    for i, d in enumerate(days):
        at = start - i * 100
        events += [e(f'w{i}', 'Watered', {}, at), e(f'd{i}', 'Soil check', {'soil': 'dry'}, at - d * 24)]
    return events


def test_estimate_is_the_species_window_when_nothing_is_declared():
    f = project([e('w', 'Watered', {}, 24)], {'kind': 'monstera'})['forecast']
    assert f['source'] == 'estimate' and (f['low_days'], f['high_days']) == START_WINDOW['half']
    assert f['factors'] == [] and f['cycles'] == 0
    assert f['check_from'].startswith('2026-09-15') and f['dry_by'].startswith('2026-09-22')


def test_declared_context_moves_the_estimate_and_is_named():
    small_sun = project([], {'kind': 'monstera', 'pot': 'Small pot', 'light': 'Direct sun', 'material': 'Terracotta'})['forecast']
    assert small_sun['factors'] == ['small_pot', 'terracotta', 'direct_sun']
    assert small_sun['low_days'] < START_WINDOW['half'][0] and small_sun['high_days'] < START_WINDOW['half'][1]
    slow = project([], {'kind': 'monstera', 'pot': 'Large pot', 'drainage': 'No', 'light': 'Low light'})['forecast']
    assert slow['low_days'] > START_WINDOW['half'][0]
    # No watering yet: a window, but no dates to anchor it.
    assert slow['check_from'] is None and slow['dry_by'] is None


def test_stacked_factors_stay_bounded():
    low, high, _ = estimate({'pot': 'Large pot', 'drainage': 'No', 'substrate': 'Dense / holds water', 'light': 'Low light'}, 'full')
    assert high <= START_WINDOW['full'][1] * 1.6 + 1e-9


def test_own_cycles_take_over_from_three():
    one = project(cycles(2), {'kind': 'monstera'})['forecast']
    assert one['source'] == 'blend' and one['cycles'] == 1
    assert 2 <= one['low_days'] < START_WINDOW['half'][0]
    three = project(cycles(2, 3, 2), {'kind': 'monstera', 'pot': 'Small pot'})['forecast']
    assert three['source'] == 'cycles' and (three['low_days'], three['high_days']) == (2, 3)
    assert three['factors'] == []


def test_many_cycles_use_the_middle_half():
    days = [2, 3, 3, 3, 9]
    hours = [d * 24 for d in days]
    f = drying_window({}, 'half', hours, None)
    assert f['source'] == 'cycles' and f['high_days'] < 9


def test_no_window_without_a_basis_or_with_a_reservoir():
    assert project([], {'kind': 'other'})['forecast'] is None
    assert project([], {'kind': 'monstera', 'self_watering': 'Yes'})['forecast'] is None
    # A plant added by name still learns from its own cycles.
    assert project(cycles(4), {'kind': 'other'})['forecast']['source'] == 'cycles'


def test_window_spares_checks_until_it_opens():
    # Monstera, nothing declared: window 7 to 14 days. Five days after watering: wait.
    plain = project([e('w', 'Watered', {}, 120)], {'kind': 'monstera'})
    assert (plain['title'], plain['action']) == ('Probably not dry yet', 'wait')
    assert plain['basis'] == ['Your watering record', 'Species reference'] and 'general estimate' in plain['reason']
    # A small pot in direct sun dries sooner: the same five days are already in its window.
    fast = project([e('w', 'Watered', {}, 120)], {'kind': 'monstera', 'pot': 'Small pot', 'light': 'Direct sun'})
    assert (fast['title'], fast['action']) == ('Around when it usually dries', 'check_soil')
    assert 'Pot details you added' in fast['basis'] and fast['tip']


def test_no_window_keeps_the_daily_check():
    g = project([e('w', 'Watered', {}, 72)], {'kind': 'monstera', 'self_watering': 'Yes'})
    assert g['title'] == 'Check the soil today'


def test_garden_snapshot_carries_the_window(planted):
    planted.post('/v1/plants/aloe-1/user-observations', json={'id': 'w1', 'type': 'Watered', 'note': '', 'observed_at': NOW.isoformat()}, headers=ALICE)
    f = planted.get('/v1/garden', headers=ALICE).json()['twins']['aloe-1']['guidance']['forecast']
    assert f['source'] == 'estimate' and f['check_from'] is not None
