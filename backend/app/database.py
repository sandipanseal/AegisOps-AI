from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, Boolean, DateTime, inspect, text
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
    scenario_key = Column(String(120), default="custom")
    # Incident lifecycle workflow: owner + key lifecycle timestamps used for SLA tracking.
    assignee = Column(String(120), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class EvidenceRecord(Base):
    __tablename__ = "evidence_records"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    source = Column(String(120), nullable=False)
    summary = Column(Text, nullable=False)
    details = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AgentTrace(Base):
    __tablename__ = "agent_traces"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    agent_name = Column(String(120), nullable=False)
    status = Column(String(40), nullable=False)
    latency_ms = Column(Float, nullable=False)
    input_summary = Column(Text, nullable=False)
    output_summary = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class RCAReport(Base):
    __tablename__ = "rca_reports"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    suspected_root_cause = Column(Text, nullable=False)
    confidence_score = Column(Float, nullable=False)
    recommended_actions = Column(Text, nullable=False)
    risky_actions = Column(Text, nullable=False)
    requires_human_approval = Column(Boolean, default=True)
    # AI confidence explanation: JSON breakdown of the factors behind the score.
    confidence_explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RunbookExecution(Base):
    __tablename__ = "runbook_executions"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    runbook_name = Column(String(120), nullable=False)
    approved_by = Column(String(120), nullable=False)
    status = Column(String(80), nullable=False)
    result = Column(Text, nullable=False)
    # Runbook risk scoring: 0-100 score computed at approval time.
    risk_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    event_type = Column(String(80), nullable=False)
    message = Column(Text, nullable=False)
    actor = Column(String(120), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)


class Postmortem(Base):
    __tablename__ = "postmortems"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    markdown = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EvaluationResult(Base):
    __tablename__ = "evaluation_results"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    total_cases = Column(Integer, nullable=False)
    passed_cases = Column(Integer, nullable=False)
    score = Column(Float, nullable=False)
    details = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class RagDocument(Base):
    __tablename__ = "rag_documents"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(80), nullable=False)
    source_id = Column(String(120), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class NotificationEvent(Base):
    __tablename__ = "notification_events"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=True, index=True)
    channel = Column(String(80), nullable=False)
    status = Column(String(80), nullable=False)
    payload = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ModelInvocation(Base):
    __tablename__ = "model_invocations"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=True, index=True)
    provider = Column(String(80), nullable=False)
    model = Column(String(120), nullable=False)
    latency_ms = Column(Float, nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    status = Column(String(80), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class IncidentStateTransition(Base):
    """Audit trail of incident lifecycle state changes."""
    __tablename__ = "incident_state_transitions"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    from_status = Column(String(40), nullable=False)
    to_status = Column(String(40), nullable=False)
    actor = Column(String(120), default="system")
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RCAFeedback(Base):
    """Human feedback on an RCA report — feeds the eval dataset."""
    __tablename__ = "rca_feedback"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    rca_id = Column(Integer, nullable=True)
    verdict = Column(String(40), nullable=False)  # accurate | partially_accurate | inaccurate
    rating = Column(Integer, nullable=True)  # 1-5
    corrected_root_cause = Column(Text, nullable=True)
    comment = Column(Text, nullable=True)
    reviewer = Column(String(120), default="sre-oncall")
    promoted_to_eval = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EvalCase(Base):
    """A single RCA benchmark case in the managed eval dataset."""
    __tablename__ = "eval_cases"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(160), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    service_name = Column(String(120), nullable=False)
    severity = Column(String(40), default="medium")
    description = Column(Text, default="")
    expected_root_cause = Column(Text, nullable=False)
    logs = Column(Text, default="[]")  # JSON list of representative log lines
    source = Column(String(40), default="custom")  # builtin | custom | human_feedback
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CanaryAnalysis(Base):
    """Result of a canary-vs-baseline deployment comparison."""
    __tablename__ = "canary_analyses"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=True, index=True)
    service_name = Column(String(120), nullable=False)
    verdict = Column(String(40), nullable=False)  # promote | hold | rollback
    score = Column(Float, nullable=False)
    baseline = Column(Text, nullable=False)  # JSON
    canary = Column(Text, nullable=False)  # JSON
    reasons = Column(Text, nullable=False)  # JSON list
    created_at = Column(DateTime, default=datetime.utcnow)


class PromptInjectionDetection(Base):
    """A flagged prompt-injection attempt found while scanning logs/evidence."""
    __tablename__ = "prompt_injection_detections"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=True, index=True)
    source = Column(String(120), nullable=False)
    line = Column(Text, nullable=False)
    pattern = Column(String(160), nullable=False)
    severity = Column(String(40), default="medium")
    created_at = Column(DateTime, default=datetime.utcnow)


class ToolFaultInjection(Base):
    """Persisted on/off state for simulated tool failures (fallback testing)."""
    __tablename__ = "tool_fault_injections"

    id = Column(Integer, primary_key=True, index=True)
    tool = Column(String(80), nullable=False, index=True)
    active = Column(Boolean, default=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


# Columns added to pre-existing tables after the initial release. create_all only
# creates missing tables, so we additively patch missing columns for databases
# (e.g. an existing PostgreSQL volume) that were created before these features.
#
# Each entry is (table, column, full DDL statement). The statements are compile-time
# constants — there is no string interpolation of identifiers into SQL — so this is
# not dynamic/injectable SQL.
_COLUMN_MIGRATIONS: list[tuple[str, str, str]] = [
    ("incidents", "assignee", "ALTER TABLE incidents ADD COLUMN assignee VARCHAR(120)"),
    ("incidents", "acknowledged_at", "ALTER TABLE incidents ADD COLUMN acknowledged_at TIMESTAMP"),
    ("incidents", "resolved_at", "ALTER TABLE incidents ADD COLUMN resolved_at TIMESTAMP"),
    ("rca_reports", "confidence_explanation", "ALTER TABLE rca_reports ADD COLUMN confidence_explanation TEXT"),
    ("runbook_executions", "risk_score", "ALTER TABLE runbook_executions ADD COLUMN risk_score DOUBLE PRECISION"),
]


def _ensure_columns() -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    present: dict[str, set[str]] = {}
    with engine.begin() as conn:
        for table, column, statement in _COLUMN_MIGRATIONS:
            if table not in tables:
                continue
            if table not in present:
                present[table] = {col["name"] for col in inspector.get_columns(table)}
            if column in present[table]:
                continue
            conn.execute(text(statement))


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
