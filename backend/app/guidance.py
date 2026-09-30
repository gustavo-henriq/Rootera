"""Guidance: the Plant Twin, projected from what the caregiver observes (no sensors).

Inputs are kept apart and every suggestion lists the basis it came from:
- USER evidence (soil checks in three layers, waterings, appearance),
- the plant's declared context (pot, drainage, reservoir, light, spot),
- the species reference notes (general, not about this plant),
- this week's local weather, only to nudge the drying window (forecast.py).
One set of rules decides which check is current, so no part of the Twin can disagree
about the soil. A qualitative report such as "dry" is never turned into a percentage.
"""
from datetime import timedelta
from statistics import median
from .domain import parse_time, utcnow
from .forecast import drying_window
from .i18n import tr
from .soil import pooling, shallow, unreached
from .species import notes_for

DAY = 86400
# The API accepts records up to 5 minutes ahead (a phone clock slightly fast); they count now.
CLOCK_SKEW = timedelta(minutes=5)
# The pattern and window follow the most recent cycles, so a season ago does not outweigh now.
RECENT_CYCLES = 6
# A watering remembered roughly at setup: kept as the last watering, never as a cycle start.
# Older records only carry the note, in the language of the app at the time.
APPROXIMATE_NOTES = ('Approximate date, from setup', 'Data aproximada, da configuração')
# How long a check that found moisture keeps the plant resting before the app asks again.
# "Nearly dry" says check tomorrow, so it must be askable the next morning (16 h); moist
# and wet soil need longer before another check tells anything new. A dry report stays a
# day, since soil only gets drier until someone waters.
MOIST_REPORT_HOURS = {'slightly_moist': 16, 'not_sure': 16, 'moist': 40, 'wet': 64}
# When the first check of a cycle already found the soil dry, it may have dried earlier;
# the cycle is counted as a little shorter so the next checks start a little sooner.
# Without this, the app would only ever ask on the day it expects dryness and so learn a
# drying time that is never shorter than what it already believes.
FIRST_CHECK_DRY = .8
# A check this soon after a watering still shows where that water went.
SOAK_HOURS = 48
SOIL_WORDS = {'dry': 'dry', 'slightly_moist': 'slightly moist', 'moist': 'moist', 'wet': 'very wet'}


def _days(value: float, lang: str = 'en') -> str:
    if value < 2:
        hours = max(1, round(value * 24))
        return tr('{n} hour' if hours == 1 else '{n} hours', lang, n=hours)
    return tr('{n} days', lang, n=round(value))


def approximate(event) -> bool:
    return bool(event.value.get('approximate')) or str(event.value.get('note', '')).startswith(APPROXIMATE_NOTES)


def _ago(seconds: float, lang: str = 'en') -> str:
    days = seconds / DAY
    if days < 1:
        return tr('today', lang)
    if days < 2:
        return tr('yesterday', lang)
    return tr('{n} days ago', lang, n=int(days))


def cycles(timed, spans: list | None = None):
    """(found, dried) hours for each finished cycle, in order, from (time, evidence) pairs
    sorted by time. One pass: a watering opens a cycle (unless approximate), the first dry
    check after it closes it, moist checks in between narrow when it dried. `spans`, when
    given, receives (start, days until dried) per cycle, for the weather it had."""
    found, dried = [], []
    start = last_moist = None
    for t, e in timed:
        if e.kind == 'Watered':
            start = None if approximate(e) else t
            last_moist = None
        elif start is not None and e.kind == 'Soil check' and t > start:
            soil = e.value.get('soil')
            if soil == 'dry':
                hours = (t - start).total_seconds() / 3600
                if 1 <= hours <= 1440:
                    found.append(hours)
                    moist = (last_moist - start).total_seconds() / 3600 if last_moist is not None else None
                    dried.append((moist + hours) / 2 if moist is not None else hours * FIRST_CHECK_DRY)
                    if spans is not None:
                        spans.append((start, dried[-1] / 24))
                start = None  # only the first dry check closes the cycle
            elif soil in ('slightly_moist', 'moist', 'wet'):
                last_moist = t
    return found, dried


class SensorlessGuidance:
    version = 'sensorless-2.0'

    def project(self, plant, caregiver, evidence, now=None, lang='en'):
        """`lang` only changes the wording; titles, actions and basis are decided the same way."""
        now = now or utcnow()
        _ = lambda text, **values: tr(text, lang, **values)
        age = lambda e: max(0.0, (now - parse_time(e.at)).total_seconds())
        # Each timestamp is parsed once: long histories (years of daily checks) stay fast.
        timed = sorted(((parse_time(e.at), e) for e in evidence if e.source == 'USER'), key=lambda p: (p[0], p[1].id))
        timed = [(t, e) for t, e in timed if t <= now + CLOCK_SKEW]
        events = [e for _, e in timed]
        soils = [e for e in events if e.kind == 'Soil check' and e.value.get('soil') is not None]
        water = [e for e in events if e.kind == 'Watered']
        visuals = [e for e in events if e.kind == 'Observation' and e.value.get('visual') is not None]
        last_soil = soils[-1] if soils else None
        last_water = water[-1] if water else None
        after_water = lambda e: not last_water or parse_time(e.at) > parse_time(last_water.at)
        recent_visual = visuals[-1] if visuals and age(visuals[-1]) <= DAY else None
        visual = recent_visual.value['visual'] if recent_visual and recent_visual.value['visual'] != 'not_sure' else None

        notes = notes_for(plant.get('kind'), lang)
        guided = (caregiver or {}).get('detail', 'Guided') != 'Concise'
        no_drainage = plant.get('drainage') == 'No'
        reservoir = plant.get('self_watering') == 'Yes'

        # A cycle is a watering followed by the first dry check. That check is when dryness was
        # FOUND (it depends on how often the caregiver checks), so the soil dried somewhere
        # between the last check that found moisture and it. `intervals` keeps the found time
        # (what the text reports); `dried` estimates when it dried (what the window uses).
        spans: list = []
        intervals, dried = cycles(timed, spans)
        recent = intervals[-RECENT_CYCLES:]
        # The pattern speaks of when the soil dried (estimated from the checks), the same measure
        # the drying window draws, so the page never shows two different numbers for one thing.
        baseline = round(median(dried[-RECENT_CYCLES:]) / 24, 1) if len(recent) >= 3 else None
        since_water = age(last_water) / DAY if last_water else None
        window = drying_window(plant, notes['dryness'], dried[-RECENT_CYCLES:], last_water.at if last_water else None, spans[-RECENT_CYCLES:])
        # Slow plants rest longer between checks: the rest scales with the expected cycle.
        pace = max(1.0, (window['low_days'] if window else 7) / 7)
        report_life = DAY if not last_soil or last_soil.value['soil'] == 'dry' else min(3 * DAY, MOIST_REPORT_HOURS[last_soil.value['soil']] * 3600 * pace)
        recent_soil = bool(last_soil and age(last_soil) < report_life and after_water(last_soil))
        fresh = recent_soil and last_soil.value['soil'] != 'not_sure'
        unsure = recent_soil and last_soil.value['soil'] == 'not_sure'
        condition = last_soil.value['soil'] if fresh else None
        # Dry at the last check, which is more than a day old, with no watering recorded since.
        stale_dry = bool(last_soil and not recent_soil and after_water(last_soil) and last_soil.value['soil'] == 'dry')
        # The three layers of the last check (older checks have a single reading only).
        layers = last_soil.value.get('layers') if fresh else None

        basis: list[str] = []
        tip = None
        context = []
        if no_drainage:
            context.append(_('Your pot has no drainage hole, so extra water can stay at the bottom.'))
        if reservoir:
            context.append(_('Check the self-watering reservoir before adding water.'))

        if not events:
            title, action = _('Start with a soil check'), 'check_soil'
            reason = _('A first soil check shows where this plant starts.')
            basis = ['Species reference']
            tip = notes['check_tip']
        elif visual in ('different', 'unwell') and not fresh and not unsure and not (last_water and parse_time(last_water.at) >= parse_time(recent_visual.at)):
            title, action = _('Check the soil next'), 'check_soil'
            reason = _('You noticed a change. Check the soil before changing your routine.')
            basis = ['Your appearance check']
            tip = notes['check_tip']
        elif visual in ('different', 'unwell') and not fresh and last_water and parse_time(last_water.at) >= parse_time(recent_visual.at):
            title, action = _('Look at the leaves in a day or two'), 'observe'
            reason = _('You watered after a change. Look at the leaves in a day or two before watering again.')
            basis = ['Your appearance check', 'Your watering record']
        elif fresh and visual in ('different', 'unwell'):
            title, action = _('Look at the leaves again tomorrow'), 'observe'
            reason = _('Soil {soil}, and the leaves changed. See if it continues before changing care.', soil=_(SOIL_WORDS[condition]))
            if condition == 'dry' and notes['thirst_sign']:
                reason += f" {notes['thirst_sign']}"
            reason = ' '.join([reason, *context[:1]])
            basis = ['Your soil check', 'Your appearance check', 'Species reference']
        elif pooling(layers):
            title, action = _('The bottom is still wet'), 'wait'
            reason = _('The surface is dry, but the bottom is still wet. Wait until it dries too.')
            if no_drainage:
                reason += ' ' + _('With no drainage hole, excess water has nowhere to go.')
            basis = ['Your soil check'] + (['Pot details you added'] if no_drainage else [])
        elif condition == 'dry':
            title, action = _('You found the soil dry'), 'log_water'
            reason = ' '.join([notes['when_dry'], *context])
            basis = ['Your soil check', 'Species reference'] + (['Pot details you added'] if context else [])
            if not no_drainage:
                tip = _('Pour slowly until a little drains out, then empty the saucer.')
            else:
                tip = _('If you water, use a small amount.')
        elif condition == 'slightly_moist':
            title, action = _('Nearly dry'), 'wait'
            reason = _('Still some moisture below. Check again tomorrow.')
            if notes['dryness'] == 'top':
                reason = _('Nearly dry. This species likes water around now; check tomorrow.')
            if unreached(layers) and notes['dryness'] == 'full':
                reason = _('Dry as deep as you reached. This species dries all the way, so the bottom decides.')
                tip = _('A wooden skewer to the bottom for a minute: it comes out dry when the bottom is dry.')
            basis = ['Your soil check', 'Species reference']
        elif condition in ('moist', 'wet'):
            title, action = _('Still moist' if condition == 'moist' else 'The soil is wet'), 'wait'
            reason = _('There’s moisture below the surface. Waiting keeps the roots from sitting wet.')
            if condition == 'wet' and no_drainage:
                reason += ' ' + _('With no drainage hole, excess water has nowhere to go.')
            basis = ['Your soil check'] + (['Pot details you added'] if condition == 'wet' and no_drainage else [])
        elif unsure:
            title, action = _('No clear answer yet'), 'wait'
            reason = _('That’s fine. Soil is hard to read at first; next time, try a little deeper.')
            basis = ['Your soil check']
        elif stale_dry:
            title, action = _('Check the soil today'), 'check_soil'
            reason = _('Your last check, {ago}, found it dry. Watered since? Record it. If not, check before watering.', ago=_ago(age(last_soil), lang))
            basis = ['Your soil check']
            tip = notes['check_tip']
        elif last_water and since_water < 1:
            title, action = _('Watering recorded'), 'wait'
            reason = _('Let it soak in. Check in a day or two to see how fast it dries.')
            basis = ['Your watering record']
        elif baseline is not None and last_water:
            reason = _('Last {n} cycles: dry about {baseline} after watering. It has been {since}.', n=len(recent), baseline=_days(baseline, lang), since=_days(since_water, lang))
            # The same threshold the app draws: the window opens on its first day.
            opens = window['check_after_days'] if window else baseline * .75
            if since_water < opens:
                title, action = _('Probably not dry yet'), 'wait'
            else:
                title, action = _('Around when it usually dries'), 'check_soil'
                tip = notes['check_tip']
            basis = ['Your watering records', 'Your soil checks']
        elif window and last_water:
            # Before a pattern: the drying window (a general estimate, blended with the first
            # cycles) spares daily checks right after a watering. See forecast.py.
            span = dict(low=window['low_days'], high=window['high_days'], since=_days(since_water, lang))
            if window['source'] == 'estimate':
                reason = _('Estimate for this species and pot: {low} to {high} days after watering. It has been {since}.', **span)
            else:
                reason = _('Your first cycles: about {low} to {high} days after watering. It has been {since}.', **span)
            if since_water < window['check_after_days']:
                title, action = _('Probably not dry yet'), 'wait'
            elif since_water < window['low_days']:
                # Still before the estimated window: a check now tests the estimate early.
                title, action = _('Worth an early check'), 'check_soil'
                reason += ' ' + _('An early check shows if it dries sooner.')
                tip = notes['check_tip']
            else:
                title, action = _('Around when it usually dries'), 'check_soil'
                tip = notes['check_tip']
            basis = (['Your watering records', 'Your soil checks'] if window['cycles'] else ['Your watering record'])
            basis += (['Species reference'] if window['source'] != 'cycles' else []) + (['Pot details you added'] if window['factors'] else [])
        else:
            title, action = _('Check the soil today'), 'check_soil'
            if last_soil:
                reason = _('Last soil check: {ago}. A new one keeps this current.', ago=_ago(age(last_soil), lang))
            else:
                reason = _('No check since the last watering. A quick one shows how it’s drying.')
            basis = ['Your care history']
            tip = notes['check_tip']

        if shallow(layers) and last_water and not approximate(last_water) and (parse_time(last_soil.at) - parse_time(last_water.at)).total_seconds() <= SOAK_HOURS * 3600:
            reason += ' ' + _('The bottom was still dry after the watering, so the water may not have reached it.')
            if not no_drainage:
                tip = _('Next time, pour slowly until a little water comes out of the drainage hole.')
            basis = basis + (['Your watering record'] if 'Your watering record' not in basis else [])
        signals = ['Plant context'] + (['Soil checks'] if soils else []) + (['Watering history'] if water else []) + (['Appearance notes'] if visuals else [])
        state = 'NEW' if not events else 'PATTERN' if baseline is not None else 'LEARNING'
        return {
            'version': self.version,
            'title': title, 'reason': reason, 'action': action, 'tip': tip if guided else None,
            'basis': basis,
            'state': state,
            # What the tester and the caregiver see: still analysing (species estimate), getting
            # specific (from the second cycle), or this plant's own pattern (from the third).
            'learning': _('Pattern found') if state == 'PATTERN' else _('Getting specific to your plant') if len(intervals) >= 2 else _('Still analyzing your plant'),
            'evidence_ids': [e.id for e in events], 'signals': signals,
            # completed_cycles counts every cycle; the pattern uses the most recent ones.
            'baseline_days': baseline, 'completed_cycles': len(intervals), 'pattern_cycles': len(recent),
            # When the soil dried in each recent cycle (days after watering), oldest first.
            'cycle_days': [round(h / 24, 1) for h in dried[-RECENT_CYCLES:]],
            'forecast': window,
            'baseline_note': _('Typical time until dry, from your checks.'),
            'soil': condition, 'soil_layers': layers, 'soil_checked_at': last_soil.at if recent_soil else None,
            'visual': visual,
            'last_watered_at': last_water.at if last_water else None,
            'last_soil_check_at': last_soil.at if last_soil else None,
            'reference': {'summary': notes['summary'], 'when_dry': notes['when_dry'], 'check_tip': notes['check_tip'], 'dryness': notes['dryness']},
            'weather_connected': bool(plant.get('weather')),
        }
