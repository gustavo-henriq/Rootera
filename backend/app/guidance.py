"""Sensorless guidance: user evidence + declared context, never hardware or invented weather."""
from statistics import median
from .domain import parse_time, utcnow


class SensorlessGuidance:
    version = 'sensorless-1.1'

    def project(self, plant, caregiver, evidence, now=None):
        now = now or utcnow()
        events = sorted((e for e in evidence if e.source == 'USER' and not e.demo and parse_time(e.at) <= now), key=lambda e: (parse_time(e.at), e.id))
        soils = [e for e in events if e.kind == 'Soil check' and e.value.get('soil') is not None]
        water = [e for e in events if e.kind == 'Watered']
        visuals = [e for e in events if e.kind == 'Observation' and e.value.get('visual') is not None]
        soil = soils[-1] if soils else None
        last_water = water[-1] if water else None
        fresh = bool(soil and soil.value['soil'] != 'not_sure' and (now - parse_time(soil.at)).total_seconds() <= 86400 and (not last_water or parse_time(soil.at) > parse_time(last_water.at)))
        title, reason, action = 'Let’s get to know this plant', 'One quick soil check will give us a starting point.', 'Check soil'
        if fresh:
            condition = soil.value['soil']
            if condition == 'dry':
                title, reason, action = 'You reported dry soil', 'Your below-surface check is saved. If you decide to water, record it so we can follow what changes.', 'View plant'
                if plant.get('drainage') == 'No':
                    reason += ' Your pot has no drainage hole, so water may remain deeper inside.'
                if plant.get('self_watering') == 'Yes':
                    reason += ' Check the reservoir before adding water.'
            else:
                title, reason, action = 'Give it a little time', 'You reported moisture in the soil. Wait before adding more water and keep observing.', 'View plant'
        elif last_water and (now - parse_time(last_water.at)).total_seconds() < 86400:
            title, reason, action = 'Watering recorded', 'Let the water settle. Your next check will help us understand how the soil changes.', 'View plant'
        recent_visual = visuals[-1] if visuals and (now - parse_time(visuals[-1].at)).total_seconds() <= 86400 else None
        if recent_visual and recent_visual.value['visual'] in ('different', 'unwell'):
            if fresh:
                title = 'Keep an eye on the change'
                reason = 'Your appearance and soil checks are saved. Watch whether the change continues before changing your care routine.'
                if plant.get('drainage') == 'No':
                    reason += ' Your pot has no drainage hole, so avoid leaving water inside.'
                action = 'View plant'
            elif last_water and parse_time(last_water.at) >= parse_time(recent_visual.at):
                title, reason, action = 'Watch how it responds', 'You recorded watering after noticing a change. Let it settle and observe the leaves before adding more water.', 'View plant'
            else:
                title, reason, action = 'Let’s look at what changed', 'You noticed a visual change. A soil check can add context before you change your care routine.', 'Check soil'
        # An interval is a first observed dry check after watering, not a measured drying time.
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
        learning = 'Getting started' if not events else 'Learning'
        if baseline is not None:
            learning = 'Medium confidence'
        signals = ['Plant context'] + (['Soil check-ins'] if soils else []) + (['Watering history'] if water else []) + (['Visual observations'] if visuals else [])
        # Context that affects a care decision must survive the concise preference.
        return {'version': self.version, 'title': title, 'reason': reason, 'action': action,
                'learning': learning, 'state': 'NEW' if not events else 'LEARNING', 'evidence_ids': [e.id for e in events], 'signals': signals,
                'baseline_days': baseline, 'completed_cycles': len(intervals), 'soil': soil.value['soil'] if fresh else None,
                'visual': recent_visual.value['visual'] if recent_visual and recent_visual.value['visual'] != 'not_sure' else None,
                'baseline_note': 'Typical time until your first dry check after watering. Check frequency affects this estimate.',
                'weather_connected': False}
