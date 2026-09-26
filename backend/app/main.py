"""Rootera Plant Twin API.

Layers: routes (HTTP) -> GardenService (use cases) -> Plant Twin (domain rules)
-> SQLAlchemy models (SQLite locally, PostgreSQL through DATABASE_URL).
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import select
from .config import Settings
from .db import Base, Profile, make_database
from .deps import integrations
from .routes import analytics, devices, garden, integrations as integration_routes
from .schemas import PlantIn
from .service import GardenService

DEMO_SEED = [('Aloe Vera', 'Aloe barbadensis miller', 'aloe'), ('Peace Lily', 'Spathiphyllum wallisii', 'peace-lily'), ('Monstera', 'Monstera deliciosa', 'monstera')]


def create_app(database_url=None, demo=None, tokens=None, **overrides):
    config = Settings.from_env(database_url=database_url, demo=demo, tokens=tokens, **overrides)
    engine, factory = make_database(config.database_url)

    @asynccontextmanager
    async def lifespan(app):
        # Initial schema for the starter. Use reviewed migrations for later releases.
        Base.metadata.create_all(engine)
        with factory.begin() as db:
            for owner in set(config.tokens.values()):
                if db.get(Profile, owner) is None:
                    db.add(Profile(id=owner, data={'name': '', 'onboarded': False, 'plan': 'Free', 'annual': False, 'reminders': True}))
                    db.flush()
                    if owner == 'demo' and config.seed_demo:
                        for i, (name, species, kind) in enumerate(DEMO_SEED):
                            GardenService(db, owner).add_plant(PlantIn(id=f'plant-{i}', name=name, species=species, kind=kind, room='Living room', light='Bright indirect light'))
        yield
        engine.dispose()

    app = FastAPI(title='Rootera Plant Twin API', version='2.0.0', lifespan=lifespan)
    app.state.settings, app.state.factory = config, factory
    # Garden snapshots are repetitive JSON: compression cuts them by about 10x on mobile data.
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(CORSMiddleware, allow_origins=list(config.cors_origins), allow_methods=['GET', 'POST', 'PATCH', 'DELETE'], allow_headers=['Authorization', 'Content-Type'])

    @app.get('/health')
    def health():
        with factory() as db:
            db.execute(select(1))
        return {'status': 'ok', 'demo': config.demo, 'twin_engine': 'rules-1.0.0', 'guidance': 'sensorless-2.0', 'integrations': integrations(config)}

    app.include_router(garden.router)
    app.include_router(integration_routes.router)
    app.include_router(devices.router)
    app.include_router(analytics.router)
    return app


app = create_app()
