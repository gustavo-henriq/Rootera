"""Sensorless guidance: the inferred layer of the Plant Twin.

Inputs are kept apart and every suggestion lists the basis it came from:
- USER evidence (soil checks, watering, appearance) reported by the caregiver,
- the plant's declared context (pot, drainage, reservoir),
- the species reference notes (general, not about this plant).
Sensor readings, weather and photo analysis never feed this layer. A qualitative
report such as "dry" is never turned into a percentage.
"""
from statistics import median
from .domain import parse_time, utcnow
from .species import notes_for

DAY = 86400
SOIL_WORDS = {'dry': 'dry', 'slightly_moist': 'slightly moist', 'moist': 'moist', 'wet': 'very wet'}


def _days(value: float) -> str:
    if value < 2:
        hours = round(value * 24)
        return f'{hours} hours'
    return f'{round(value)} days'


def _ago(seconds: float) -> str:
    days = seconds / DAY
    if days < 1:
        return 'today'
    if days < 2:
        return 'yesterday'
    return f'{int(days)} days ago'


class SensorlessGuidance:
    version = 'sensorless-2.0'

    def project(self, plant, caregiver, evidence, now=None):
        now = now or utcnow()
        age = lambda e: (now - parse_time(e.at)).total_seconds()
        events = sorted((e for e in evidence if e.source == 'USER' and not e.demo and parse_time(e.at) <= now), key=lambda e: (parse_time(e.at), e.id))
        soils = [e for e in events if e.kind == 'Soil check' and e.value.get('soil') is not None]
        water = [e for e in events if e.kind == 'Watered']
        visuals = [e for e in events if e.kind == 'Observation' and e.value.get('visual') is not None]
        last_soil = soils[-1] if soils else None
        last_water = water[-1] if water else None
        after_water = lambda e: not last_water or parse_time(e.at) > parse_time(last_water.at)
        recent_soil = bool(last_soil and age(last_soil) <= DAY and after_water(last_soil))
        fresh = recent_soil and last_soil.value['soil'] != 'not_sure'
        unsure = recent_soil and last_soil.value['soil'] == 'not_sure'
        condition = last_soil.value['soil'] if fresh else None
        recent_visual = visuals[-1] if visuals and age(visuals[-1]) <= DAY else None
        visual = recent_visual.value['visual'] if recent_visual and recent_visual.value['visual'] != 'not_sure' else None

        notes = notes_for(plant.get('kind'))
        guided = (caregiver or {}).get('detail', 'Guided') != 'Concise'
        no_drainage = plant.get('drainage') == 'No'
        reservoir = plant.get('self_watering') == 'Yes'

        # A cycle interval is the first dry check after a watering. It depends on
        # how often the caregiver checks, so it is not a measured drying time.
        intervals = []
        for i, event in enumerate(water):
            start = parse_time(event.at)
            end = parse_time(water[i + 1].at) if i + 1 < len(water) else now
            dry = next((e for e in soils if e.value['soil'] == 'dry' and start < parse_time(e.at) <= end), None)
            if dry:
                hours = (parse_time(dry.at) - start).total_seconds() / 3600
                if 1 <= hours <= 1440:
                    intervals.append(hours)
        baseline = round(median(intervals) / 24, 1) if len(intervals) >= 3 else None
        since_water = age(last_water) / DAY if last_water else None

        basis: list[str] = []
        tip = None
        context = []
        if no_drainage:
            context.append('Your pot has no drainage hole, so extra water can stay at the bottom.')
        if reservoir:
            context.append('Check the self-watering reservoir before adding water.')

        if not events:
            title, action = 'Start with a soil check', 'check_soil'
            reason = f"{notes['summary']} A first check tells Rootera where this plant is starting from."
            basis = ['Species reference']
            tip = notes['check_tip']
        elif visual in ('different', 'unwell') and not fresh and not unsure and not (last_water and parse_time(last_water.at) >= parse_time(recent_visual.at)):
            title, action = 'Check the soil next', 'check_soil'
            reason = 'You noticed a change in how it looks. The soil adds context before you change anything in your routine.'
            basis = ['Your appearance check']
            tip = notes['check_tip']
        elif visual in ('different', 'unwell') and not fresh and last_water and parse_time(last_water.at) >= parse_time(recent_visual.at):
            title, action = 'Watch how it responds', 'observe'
            reason = 'You watered after noticing a change. Give it a day or two and look at the leaves again before adding more water.'
            basis = ['Your appearance check', 'Your watering record']
        elif fresh and visual in ('different', 'unwell'):
            title, action = 'Keep an eye on the change', 'observe'
            reason = f"You found the soil {SOIL_WORDS[condition]} and noticed a change in the leaves. See whether the change continues before adjusting care."
            if condition == 'dry' and notes['thirst_sign']:
                reason += f" {notes['thirst_sign']}"
            reason = ' '.join([reason, *context[:1]])
            basis = ['Your soil check', 'Your appearance check', 'Species reference']
        elif condition == 'dry':
            title, action = 'You found the soil dry', 'log_water'
            reason = ' '.join([notes['when_dry'], *context])
            basis = ['Your soil check', 'Species reference'] + (['Pot details you added'] if context else [])
            if not no_drainage:
                tip = 'If you water, pour slowly until a little drains out, then empty the saucer. Record it here so Rootera can follow the next cycle.'
            else:
                tip = 'If you water, use a small amount and record it so Rootera can follow the next cycle.'
        elif condition == 'slightly_moist':
            title, action = 'Nearly dry', 'wait'
            reason = 'There is still some moisture below the surface. Another check tomorrow will show whether it has dried through.'
            if notes['dryness'] == 'top':
                reason = 'The soil is close to dry. This species usually prefers water around this point, so a check tomorrow is worthwhile.'
            basis = ['Your soil check', 'Species reference']
        elif condition in ('moist', 'wet'):
            title, action = ('Still moist' if condition == 'moist' else 'The soil is wet'), 'wait'
            reason = 'Your check found moisture below the surface. Holding off on water for now keeps the roots from sitting wet.'
            if condition == 'wet' and no_drainage:
                reason += ' With no drainage hole, excess water has nowhere to go.'
            basis = ['Your soil check'] + (['Pot details you added'] if condition == 'wet' and no_drainage else [])
        elif unsure:
            title, action = 'No clear answer yet', 'wait'
            reason = 'That is fine. Soil can be hard to read at first. Next time, try a little deeper or compare with how it felt right after watering.'
            basis = ['Your soil check']
        elif last_water and since_water < 1:
            title, action = 'Watering recorded', 'wait'
            reason = 'Give it time to soak in. A soil check in a day or two shows how quickly this pot dries.'
            basis = ['Your watering record']
        elif baseline is not None and last_water:
            reason = f"In your last {len(intervals)} cycles, you first found the soil dry about {_days(baseline)} after watering. It has been {_days(since_water)}."
            if since_water < baseline * .75:
                title, action = 'Probably not dry yet', 'wait'
            else:
                title, action = 'Around when it usually dries', 'check_soil'
                tip = notes['check_tip']
            basis = ['Your watering records', 'Your soil checks']
        else:
            title, action = 'Time for a fresh check', 'check_soil'
            if last_soil:
                reason = f"Your last soil check was {_ago(age(last_soil))}. Soil changes day to day, so a new check keeps the picture current."
            else:
                reason = 'There is no soil check since the last watering. A quick check shows how this pot is drying.'
            basis = ['Your care history']
            tip = notes['check_tip']

        signals = ['Plant context'] + (['Soil checks'] if soils else []) + (['Watering history'] if water else []) + (['Appearance notes'] if visuals else [])
        state = 'NEW' if not events else 'PATTERN' if baseline is not None else 'LEARNING'
        return {
            'version': self.version,
            'title': title, 'reason': reason, 'action': action, 'tip': tip if guided else None,
            'basis': basis,
            'state': state,
            'learning': {'NEW': 'Getting started', 'LEARNING': 'Learning', 'PATTERN': 'Pattern found'}[state],
            'evidence_ids': [e.id for e in events], 'signals': signals,
            'baseline_days': baseline, 'completed_cycles': len(intervals),
            'baseline_note': 'Typical time until your first dry check after watering. How often you check affects this number.',
            'soil': condition, 'soil_checked_at': last_soil.at if recent_soil else None,
            'visual': visual,
            'last_watered_at': last_water.at if last_water else None,
            'last_soil_check_at': last_soil.at if last_soil else None,
            'reference': {'summary': notes['summary'], 'when_dry': notes['when_dry'], 'check_tip': notes['check_tip']},
            'weather_connected': False,
        }
