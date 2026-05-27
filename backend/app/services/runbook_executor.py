from pathlib import Path
import yaml
from app.metrics import RUNBOOK_EXECUTIONS


class RunbookExecutor:
    def __init__(self) -> None:
        self.runbook_dir = Path(__file__).resolve().parent.parent / "runbooks"

    def execute(self, runbook_name: str, service_name: str) -> dict:
        path = self.runbook_dir / f"{runbook_name}.yaml"
        if not path.exists():
            raise FileNotFoundError(f"Runbook not found: {runbook_name}")

        with path.open("r", encoding="utf-8") as file:
            runbook = yaml.safe_load(file)

        RUNBOOK_EXECUTIONS.inc()
        return {
            "runbook": runbook_name,
            "service": service_name,
            "status": "simulated_success",
            "risk_level": runbook.get("risk_level", "unknown"),
            "executed_steps": runbook.get("steps", []),
            "note": "MVP mode: no production infrastructure was modified.",
        }
