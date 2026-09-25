"""Runtime configuration, read once from the environment.

Secrets (RevenueCat, Pl@ntNet, user tokens) live only on the server. The mobile
app receives nothing but public identifiers.
"""
import json
import os
from dataclasses import dataclass, field


def _flag(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() == 'true'


@dataclass(frozen=True)
class Settings:
    database_url: str | None = None
    demo: bool = True
    tokens: dict[str, str] = field(default_factory=dict)
    cors_origins: tuple[str, ...] = ('http://localhost:8081', 'http://127.0.0.1:8081')
    seed_demo: bool = False
    revenuecat_secret_key: str = ''
    revenuecat_entitlement: str = 'plus'
    revenuecat_webhook_auth: str = ''
    plantnet_api_key: str = ''

    @property
    def billing_configured(self) -> bool:
        return bool(self.revenuecat_secret_key)

    @property
    def identification_configured(self) -> bool:
        return bool(self.plantnet_api_key)

    @classmethod
    def from_env(cls, **overrides) -> 'Settings':
        values = dict(
            database_url=os.getenv('DATABASE_URL') or None,
            demo=_flag('ROOTERA_DEMO', 'true'),
            tokens=json.loads(os.getenv('ROOTERA_USER_TOKENS', '{}')),
            cors_origins=tuple(o.strip() for o in os.getenv('CORS_ORIGINS', 'http://localhost:8081,http://127.0.0.1:8081').split(',') if o.strip()),
            seed_demo=_flag('ROOTERA_SEED_DEMO', 'false'),
            revenuecat_secret_key=os.getenv('REVENUECAT_SECRET_KEY', ''),
            revenuecat_entitlement=os.getenv('REVENUECAT_ENTITLEMENT', 'plus'),
            revenuecat_webhook_auth=os.getenv('REVENUECAT_WEBHOOK_AUTH', ''),
            plantnet_api_key=os.getenv('PLANTNET_API_KEY', ''),
        )
        values.update({k: v for k, v in overrides.items() if v is not None})
        settings = cls(**values)
        tokens = dict(settings.tokens)
        if settings.demo:
            tokens['rootera-local-demo'] = 'demo'
        if not tokens:
            raise RuntimeError('Configure ROOTERA_USER_TOKENS when demo mode is disabled.')
        return cls(**{**values, 'tokens': tokens})
