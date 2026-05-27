from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, Boolean, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    service_name = Column(String(120), nullable=False)
    severity = Column(String(40), nullable=False)
    status = Column(String(40), default="open")
    created_at = Column(DateTime, default=datetime.utcnow)


class RCAReport(Base):
    __tablename__ = "rca_reports"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False)
    suspected_root_cause = Column(Text, nullable=False)
    confidence_score = Column(Float, nullable=False)
    recommended_actions = Column(Text, nullable=False)
    risky_actions = Column(Text, nullable=False)
    requires_human_approval = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RunbookExecution(Base):
    __tablename__ = "runbook_executions"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False)
    runbook_name = Column(String(120), nullable=False)
    approved_by = Column(String(120), nullable=False)
    status = Column(String(80), nullable=False)
    result = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
