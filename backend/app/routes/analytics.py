"""Product analytics for the onboarding funnel: which steps are seen and completed.

Events are anonymous (a step name and a few flags), stored next to the garden,
and never sent to a third party.
"""
from collections import Counter
from fastapi import APIRouter, Depends
from sqlalchemy import select
from ..db import ProductEvent
from ..deps import demo_only, owner, session
from ..schemas import ProductEventsIn

router = APIRouter(prefix='/v1')


@router.post('/events', status_code=202)
def record(body: ProductEventsIn, user: str = Depends(owner), db=Depends(session)):
    for e in body.events:
        db.add(ProductEvent(owner_id=user, name=e.name, props=e.props, at=e.at))
    return {'accepted': len(body.events)}


@router.get('/events/funnel', dependencies=[Depends(demo_only)])
def funnel(user: str = Depends(owner), db=Depends(session)):
    """Counts per event and step, for the preview's own funnel report."""
    rows = db.execute(select(ProductEvent.name, ProductEvent.props)).all()
    counts = Counter(f"{name}:{props.get('step', '')}".rstrip(':') for name, props in rows)
    return {'events': dict(sorted(counts.items()))}
