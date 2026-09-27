"""Billing (RevenueCat) and photo identification (Pl@ntNet).

Both are optional: without credentials the endpoints answer 503 with a plain
explanation, and the app keeps working in its documented demo mode.
"""
import secrets
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from ..config import Settings
from ..deps import demo_only, service, settings
from ..db import Profile
from ..integrations import plantnet, revenuecat
from ..schemas import DemoPlanIn, IdentifyIn

router = APIRouter(prefix='/v1')


@router.post('/billing/sync')
def billing_sync(s=Depends(service), config: Settings = Depends(settings)):
    """Ask RevenueCat for this user's entitlement and store the resulting plan."""
    try:
        ent = revenuecat.active_entitlement(s.owner, config.revenuecat_secret_key, config.revenuecat_entitlement)
    except revenuecat.BillingUnavailable as error:
        raise HTTPException(503, str(error))
    return s.set_plan('Plus' if ent['active'] else 'Free', ent['annual'], 'revenuecat')


@router.post('/billing/webhook')
def billing_webhook(request: Request, body: dict, authorization: str = Header(default=''), config: Settings = Depends(settings)):
    if not config.revenuecat_webhook_auth or not secrets.compare_digest(authorization, config.revenuecat_webhook_auth):
        raise HTTPException(401, 'Invalid webhook authorization')
    user = (body.get('event') or {}).get('app_user_id')
    if not user:
        return {'ignored': True}
    try:
        ent = revenuecat.active_entitlement(user, config.revenuecat_secret_key, config.revenuecat_entitlement)
    except revenuecat.BillingUnavailable as error:
        raise HTTPException(503, str(error))
    with request.app.state.factory.begin() as db:
        profile = db.get(Profile, user)
        if profile is None:
            return {'ignored': True}
        profile.data = {**profile.data, 'plan': 'Plus' if ent['active'] else 'Free', 'annual': ent['annual'], 'plan_source': 'revenuecat'}
    return {'updated': True}


@router.post('/demo/plan', dependencies=[Depends(demo_only)])
def demo_plan(payload: DemoPlanIn, s=Depends(service)):
    """Simulated entitlement for previews without RevenueCat. Disabled outside demo mode."""
    return {'demo': True, **s.set_plan(payload.plan, payload.annual, 'demo')}


@router.post('/identify')
def identify(payload: IdentifyIn, s=Depends(service), config: Settings = Depends(settings)):
    try:
        return {'results': plantnet.identify(payload.image_base64, payload.organ, config.plantnet_api_key, lang=s.lang), 'source': 'Pl@ntNet'}
    except plantnet.IdentificationUnavailable as error:
        raise HTTPException(503, str(error))
    except ValueError as error:
        raise HTTPException(422, str(error))
