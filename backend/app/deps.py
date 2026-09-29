"""Request dependencies: authentication, transaction scope and the garden service."""
import secrets
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .config import Settings
from .i18n import lang_from
from .service import GardenService

bearer = HTTPBearer()


def settings(request: Request) -> Settings:
    return request.app.state.settings


def owner(request: Request, auth: HTTPAuthorizationCredentials = Depends(bearer)) -> str:
    for token, user in request.app.state.settings.tokens.items():
        if secrets.compare_digest(token, auth.credentials):
            return user
    raise HTTPException(401, 'Invalid user token')


def session(request: Request):
    # One transaction per request: committed on success, rolled back on error.
    with request.app.state.factory.begin() as db:
        yield db


def integrations(config: Settings) -> dict:
    return {'billing': config.billing_configured, 'identification': config.identification_configured, 'weather': True, 'demo': config.demo}


def service(request: Request, user: str = Depends(owner), db=Depends(session)) -> GardenService:
    config = request.app.state.settings
    return GardenService(db, user, integrations(config), lang_from(request.headers.get('accept-language')), seed_example=config.seed_example)


def demo_only(config: Settings = Depends(settings)):
    if not config.demo:
        raise HTTPException(403, 'Demo operations are disabled')
