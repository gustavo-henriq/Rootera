"""Relational storage. SQLite locally; PostgreSQL through DATABASE_URL."""
import os
from pathlib import Path
from sqlalchemy import JSON, Float, ForeignKey, Integer, String, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

class Base(DeclarativeBase):
    pass

class Profile(Base):
    __tablename__ = 'profiles'
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)

class Plant(Base):
    __tablename__ = 'plants'
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), index=True)
    data: Mapped[dict] = mapped_column(JSON)
    revision: Mapped[int] = mapped_column(Integer, default=0)

class UserObservation(Base):
    __tablename__ = 'user_observations'
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    plant_id: Mapped[str] = mapped_column(ForeignKey('plants.id'), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'))
    kind: Mapped[str] = mapped_column(String(40))
    value: Mapped[dict] = mapped_column(JSON)
    observed_at: Mapped[str] = mapped_column(String(40), index=True)
    received_at: Mapped[str] = mapped_column(String(40))
    confidence: Mapped[float] = mapped_column(Float)

class ProductEvent(Base):
    """Anonymous product analytics (onboarding steps and the like). No personal data."""
    __tablename__ = 'product_events'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(60), index=True)
    props: Mapped[dict] = mapped_column(JSON)
    at: Mapped[str] = mapped_column(String(40))

class DomainEvent(Base):
    __tablename__ = 'domain_events'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    plant_id: Mapped[str] = mapped_column(ForeignKey('plants.id'), index=True)
    type: Mapped[str] = mapped_column(String(80))
    source: Mapped[str] = mapped_column(String(20))
    observation_id: Mapped[str] = mapped_column(String(80))
    occurred_at: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSON)

class TwinSnapshot(Base):
    __tablename__ = 'plant_twins'
    plant_id: Mapped[str] = mapped_column(ForeignKey('plants.id'), primary_key=True)
    engine_version: Mapped[str] = mapped_column(String(40))
    evaluated_at: Mapped[str] = mapped_column(String(40))
    state: Mapped[dict] = mapped_column(JSON)

def make_database(url: str | None = None):
    default = Path(__file__).resolve().parents[1] / 'rootera.db'
    url = url or os.getenv('DATABASE_URL', f'sqlite:///{default.as_posix()}')
    engine = create_engine(url, pool_pre_ping=True, connect_args={'check_same_thread': False, 'timeout': 30} if url.startswith('sqlite') else {})
    if url.startswith('sqlite'):
        @event.listens_for(engine, 'connect')
        def pragma(conn, _):
            conn.execute('PRAGMA foreign_keys=ON')
            conn.execute('PRAGMA journal_mode=WAL')
    return engine, sessionmaker(engine, expire_on_commit=False)
