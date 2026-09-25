"""Reference layer of the Plant Twin: general, species-level care notes.

These are curated, qualitative notes, not measurements and not predictions.
The UI labels them as general reference, separate from what the caregiver
reported and from what Rootera infers for this particular plant.
"""

SPECIES_NOTES = {
    'aloe': {
        'dryness': 'full',
        'summary': 'Stores water in its leaves and tolerates dry soil well.',
        'when_dry': 'Aloe usually does best when the soil dries through before the next watering.',
        'check_tip': 'Push a finger into the soil up to the second knuckle. For aloe, dry all the way down is normal before watering.',
        'thirst_sign': 'Thin, curling or wrinkled leaves can follow a long dry spell.',
    },
    'peace-lily': {
        'dryness': 'top',
        'summary': 'Prefers soil that stays lightly moist and does not dry out completely.',
        'when_dry': 'Peace lilies usually prefer water once the top layer feels dry, before the whole pot dries out.',
        'check_tip': 'Touch the top 2-3 cm of soil. Dry at that depth is usually the cue for a peace lily.',
        'thirst_sign': 'Drooping leaves are a common sign of thirst for this species.',
    },
    'monstera': {
        'dryness': 'half',
        'summary': 'Likes a drink once the upper part of the soil has dried.',
        'when_dry': 'Monstera usually does well when roughly the top third of the soil has dried.',
        'check_tip': 'Push a finger about 5 cm into the soil. Dry at that depth is usually the cue for a monstera.',
        'thirst_sign': 'Curling or drooping leaves can mean the soil stayed dry for a while.',
    },
    'pothos': {
        'dryness': 'top',
        'summary': 'Forgiving and adaptable; recovers well from a short dry spell.',
        'when_dry': 'Pothos usually does well when the top few centimetres have dried.',
        'check_tip': 'Touch the top 3-5 cm of soil. Dry at that depth is usually the cue for a pothos.',
        'thirst_sign': 'Soft, drooping leaves often perk up after watering.',
    },
    'snake-plant': {
        'dryness': 'full',
        'summary': 'Stores water in thick leaves and prefers to dry out fully.',
        'when_dry': 'Snake plants usually do best when the soil has dried through before the next watering.',
        'check_tip': 'Push a finger deep into the soil or use a wooden skewer. Dry all the way down is normal before watering.',
        'thirst_sign': 'Wrinkled or folding leaves can follow a very long dry spell.',
    },
    'zz': {
        'dryness': 'full',
        'summary': 'Stores water in underground rhizomes and handles dry soil well.',
        'when_dry': 'ZZ plants usually prefer soil that has dried through before watering.',
        'check_tip': 'Push a finger deep into the soil. Dry all the way down is normal for a ZZ before watering.',
        'thirst_sign': 'Wrinkled stems can appear after a long dry period.',
    },
    'pilea': {
        'dryness': 'top',
        'summary': 'Likes the top of the soil to dry, but not the whole pot.',
        'when_dry': 'Pileas usually do well when the top few centimetres have dried.',
        'check_tip': 'Touch the top 2-3 cm of soil. Dry at that depth is usually the cue for a pilea.',
        'thirst_sign': 'Drooping, soft leaves are a common sign of thirst.',
    },
    'cactus': {
        'dryness': 'full',
        'summary': 'Built for dry spells; soggy soil is the bigger risk.',
        'when_dry': 'Cacti usually do best when the soil has dried completely before watering.',
        'check_tip': 'Push a wooden skewer to the bottom of the pot. If it comes out clean and dry, the soil has dried through.',
        'thirst_sign': 'A shrivelled or wrinkled surface can mean it has been dry for a long time.',
    },
    'gerbera': {
        'dryness': 'top',
        'summary': 'A flowering plant that likes evenly moist soil, never soggy, and bright light.',
        'when_dry': 'Gerberas usually want water once the top 2-3 cm of soil have dried.',
        'check_tip': 'Touch the top 2-3 cm of soil. Dry at that depth is usually the cue for a gerbera. Water the soil, not the crown of leaves.',
        'thirst_sign': 'Flower stems and leaves droop quickly when it is thirsty.',
    },
    'sunflower': {
        'dryness': 'top',
        'summary': 'A sun-loving annual with a deep root; it drinks more in heat and while it flowers.',
        'when_dry': 'Sunflowers usually want water once the top few centimetres have dried, more often in hot weather.',
        'check_tip': 'Push a finger about 5 cm into the soil. Dry at that depth is usually the cue for a sunflower.',
        'thirst_sign': 'Leaves hang limp in the heat of the day when the soil has dried.',
    },
    'orchid': {
        'dryness': 'half',
        'summary': 'Usually grown in bark, not soil; the roots need air as much as water.',
        'when_dry': 'Moth orchids usually want water once the bark has nearly dried and the roots have turned silvery.',
        'check_tip': 'Look at the roots through the pot: silvery grey means dry, green means there is still water. A wooden skewer in the bark also works.',
        'thirst_sign': 'Limp, wrinkled leaves can follow a long dry spell.',
    },
    'fern': {
        'dryness': 'top',
        'summary': 'Likes soil that stays lightly moist and humid air; it does not like drying out.',
        'when_dry': 'Ferns usually want water as soon as the surface starts to feel dry.',
        'check_tip': 'Touch the top 1-2 cm of soil. For a fern, dry at the surface is already the cue.',
        'thirst_sign': 'Fronds turn crisp or pale at the tips when the soil dries out.',
    },
    'echeveria': {
        'dryness': 'full',
        'summary': 'A succulent that stores water in its leaves; soggy soil is the bigger risk.',
        'when_dry': 'Echeverias usually do best when the soil has dried completely before watering.',
        'check_tip': 'Push a wooden skewer to the bottom of the pot. If it comes out clean and dry, the soil has dried through.',
        'thirst_sign': 'Leaves turn soft and slightly wrinkled after a long dry spell.',
    },
    'rubber-plant': {
        'dryness': 'half',
        'summary': 'A sturdy fig that likes the upper part of the soil to dry between waterings.',
        'when_dry': 'Rubber plants usually do well when roughly the top third of the soil has dried.',
        'check_tip': 'Push a finger about 5 cm into the soil. Dry at that depth is usually the cue for a rubber plant.',
        'thirst_sign': 'Leaves can droop or curl slightly when the soil stays dry.',
    },
    'calathea': {
        'dryness': 'top',
        'summary': 'Likes soil that stays lightly moist and dislikes both drying out and sitting wet.',
        'when_dry': 'Calatheas usually want water once the top 2 cm of soil have dried.',
        'check_tip': 'Touch the top 2 cm of soil. Dry at that depth is usually the cue for a calathea.',
        'thirst_sign': 'Leaves curl inward when it is thirsty.',
    },
    'basil': {
        'dryness': 'top',
        'summary': 'A soft-leaved herb that likes steady moisture and plenty of light.',
        'when_dry': 'Basil usually wants water once the top 2 cm of soil have dried.',
        'check_tip': 'Touch the top 2 cm of soil. Dry at that depth is usually the cue for basil.',
        'thirst_sign': 'Leaves wilt quickly when the soil dries, and usually recover after watering.',
    },
}

GENERIC = {
    'dryness': 'unknown',
    'summary': 'No species notes yet. Guidance relies on what you observe.',
    'when_dry': 'Needs vary a lot between species, so your own checks matter most here.',
    'check_tip': 'Push a finger a few centimetres into the soil and note whether it feels dry, slightly moist or wet.',
    'thirst_sign': '',
}


def notes_for(kind: str | None) -> dict:
    return SPECIES_NOTES.get(kind or '', GENERIC)
