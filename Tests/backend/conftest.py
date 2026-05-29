"""Test harness: hermetic, in-memory, no external services required.

Environment is forced into a deterministic state *before* the app is imported so the
agents fall back cleanly (no live services, Loki, InferOps, Slack, or PagerDuty), and the
database is an in-memory SQLite shared across the test session.
"""
import os

# Force isolation before app/config import. These override any local .env.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SERVICE_REGISTRY"] = ""          # no live services -> instant fixture fallback
os.environ["LOKI_URL"] = "http://localhost:1"  # fails fast -> empty log results
os.environ["INFEROPS_AI_URL"] = ""           # deterministic fallback RCA
os.environ["OPENAI_API_KEY"] = ""            # no live OpenAI fallback -> deterministic RCA
os.environ["SLACK_WEBHOOK_URL"] = ""         # simulated notifications
os.environ["PAGERDUTY_ROUTING_KEY"] = ""
os.environ["ENABLE_K8S_ADAPTER"] = "false"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.main import app, get_db

# A single shared in-memory connection (StaticPool) usable across threads.
_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_Session = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


def _override_get_db():
    db = _Session()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def _prepare_database():
    Base.metadata.create_all(bind=_engine)
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture(scope="session")
def client(_prepare_database):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def analyzed_incident(client):
    """Create an incident from a scenario and run the full agentic RCA workflow."""
    incident = client.post("/incidents/from-scenario/payment_pool_regression").json()
    client.post(f"/incidents/{incident['id']}/analyze")
    return incident
