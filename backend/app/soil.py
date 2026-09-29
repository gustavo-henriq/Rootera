"""A soil check in three layers: the surface, the middle and the bottom of the pot, each
reported as dry, moist or wet (the bottom may also be 'unreached': no skewer at hand).

Which layers decide whether the plant is dry depends on the species (species.py
`dryness`): plants watered when the top dries look at the surface, plants that like to
dry halfway look at the surface and the middle, succulents and other plants that dry
through look at all three. The layers are summarised into the single scale the rest of
the Twin already speaks (dry, slightly_moist, moist, wet), and they also show patterns a
single reading cannot: water sitting at the bottom, or a watering that never reached it.

Nothing here is a measurement: these are the caregiver's own words, kept as said.
"""
from typing import Literal

Layer = Literal['dry', 'moist', 'wet']
LAYERS = ('top', 'middle', 'bottom')
# The layers that decide "dry" for each species depth.
DECISIVE = {'top': ('top',), 'half': ('top', 'middle'), 'full': ('top', 'middle', 'bottom'), 'unknown': ('top', 'middle')}


def summarize(layers: dict, dryness: str | None) -> str:
    """The single-scale reading for a three-layer check, judged at the species' depth."""
    decisive = DECISIVE.get(dryness or 'unknown', DECISIVE['unknown'])
    read = [layers.get(k) for k in decisive]
    if 'wet' in read:
        return 'wet'
    # A surface plant with a wet middle is not ready, even with a dry top.
    if decisive == ('top',) and layers.get('middle') == 'wet':
        return 'slightly_moist'
    if all(v == 'dry' for v in read):
        return 'dry'
    # Dry down to what could be reached, the bottom unknown: nearly dry, not dry.
    if all(v in ('dry', 'unreached') for v in read):
        return 'slightly_moist'
    # Drying from the top down: the surface is dry, the depth that matters is not yet.
    if layers.get('top') == 'dry':
        return 'slightly_moist'
    return 'moist'


def pooling(layers: dict | None) -> bool:
    """Water sitting at the bottom while the surface looks dry: the classic overwatering trap."""
    return bool(layers) and layers.get('top') == 'dry' and layers.get('bottom') == 'wet'


def shallow(layers: dict | None) -> bool:
    """Wet or moist on top, dry at the bottom: the water did not reach the bottom."""
    return bool(layers) and layers.get('top') in ('moist', 'wet') and layers.get('bottom') == 'dry'


def unreached(layers: dict | None) -> bool:
    return bool(layers) and layers.get('bottom') == 'unreached'
