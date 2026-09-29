"""RevenueCat entitlement check, server side.

The app purchases through the RevenueCat SDK with a public key. The server never
trusts the app's claim: it asks RevenueCat's REST API with the secret key, which
exists only in the backend environment (REVENUECAT_SECRET_KEY).
"""
from datetime import datetime, timezone
from urllib.parse import quote
import httpx

API = 'https://api.revenuecat.com/v1/subscribers/'


class BillingUnavailable(Exception):
    pass


def active_entitlement(app_user_id: str, secret_key: str, entitlement: str, client: httpx.Client | None = None) -> dict:
    if not secret_key:
        raise BillingUnavailable('RevenueCat is not configured on the server.')
    own = client is None
    client = client or httpx.Client(timeout=10)
    try:
        response = client.get(API + quote(app_user_id, safe=''), headers={'Authorization': f'Bearer {secret_key}'})
    except httpx.HTTPError as error:
        raise BillingUnavailable('Could not reach RevenueCat.') from error
    finally:
        if own:
            client.close()
    if response.status_code != 200:
        raise BillingUnavailable(f'RevenueCat returned {response.status_code}.')
    ent = response.json().get('subscriber', {}).get('entitlements', {}).get(entitlement)
    if not ent:
        return {'active': False, 'annual': False}
    # A lifetime purchase has no expiry date: active for good.
    expires = ent.get('expires_date')
    active = expires is None or datetime.fromisoformat(expires.replace('Z', '+00:00')) > datetime.now(timezone.utc)
    product = (ent.get('product_identifier') or '').lower()
    return {'active': active, 'annual': 'annual' in product or 'yearly' in product, 'lifetime': expires is None and active,
            'product': ent.get('product_identifier'), 'expires_at': expires}
