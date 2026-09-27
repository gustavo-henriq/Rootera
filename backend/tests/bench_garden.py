"""How long a garden snapshot takes with many plants and long histories.

Run: .venv/Scripts/python.exe tests/bench_garden.py [plants] [days]
Builds a throwaway SQLite database in a temp folder (never the real one).
"""
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Plant, UserObservation  # noqa: E402
from app.main import create_app  # noqa: E402

PLANTS = int(sys.argv[1]) if len(sys.argv) > 1 else 500
DAYS = int(sys.argv[2]) if len(sys.argv) > 2 else 365
H = {'Authorization': 'Bearer t'}

with tempfile.TemporaryDirectory() as tmp:
    app = create_app(f'sqlite:///{Path(tmp, "bench.db").as_posix()}', demo=False, tokens={'t': 'u'}, seed_example=False)
    with TestClient(app) as client:
        now = datetime.now(timezone.utc)
        rows = 0
        with app.state.factory.begin() as db:
            for p in range(PLANTS):
                pid = f'p{p}'
                db.add(Plant(id=pid, owner_id='u', data={'id': pid, 'name': f'Plant {p}', 'species': 'Monstera deliciosa', 'kind': 'monstera', 'plan': 'Plus'}))
                t, n = now - timedelta(days=DAYS), 0
                while t < now:
                    db.add(UserObservation(id=f'{pid}-w{n}', plant_id=pid, owner_id='u', kind='Watered', value={'note': ''}, observed_at=t.isoformat(), received_at=t.isoformat(), confidence=.65))
                    for d in (2, 4, 6):
                        at = t + timedelta(days=d)
                        if at < now:
                            db.add(UserObservation(id=f'{pid}-s{n}-{d}', plant_id=pid, owner_id='u', kind='Soil check', value={'note': '', 'soil': 'dry' if d == 6 else 'moist'}, observed_at=at.isoformat(), received_at=at.isoformat(), confidence=.65))
                            rows += 1
                    rows += 1
                    n += 1
                    t += timedelta(days=6.5)
        print(f'{PLANTS} plants, {rows} records over {DAYS} days')
        for label, headers in (('en', H), ('pt', {**H, 'Accept-Language': 'pt-BR'})):
            start = time.perf_counter()
            r = client.get('/v1/garden', headers=headers)
            took = time.perf_counter() - start
            print(f'GET /v1/garden ({label}): {r.status_code}, {took:.2f} s, {len(r.content) / 1e6:.1f} MB')
