import yaml
from pathlib import Path
from app.metrics import RUNBOOK_EXECUTIONS


class RunbookExecutor:
    def __init__(self):
        self.runbook_dir = Path(__file__).resolve().parent.parent / "runbooks"

    def list_runbooks(self) -> list[dict]:
        runbooks = []
        for path in sorted(self.runbook_dir.glob("*.yaml")):
            with path.open("r", encoding="utf-8") as file:
                data = yaml.safe_load(file)
            data["key"] = path.stem
            runbooks.append(data)
        return runbooks

    def load(self, runbook_name: str) -> dict:
        path = self.runbook_dir / f"{runbook_name}.yaml"
        if not path.exists():
            raise FileNotFoundError(f"Runbook {runbook_name} not found")
        with path.open("r", encoding="utf-8") as file:
            return yaml.safe_load(file)

    def execute(self, runbook_name: str, service_name: str) -> dict:
        runbook = self.load(runbook_name)
        RUNBOOK_EXECUTIONS.labels(runbook=runbook_name).inc()
        return {
            "runbook": runbook_name,
            "service": service_name,
            "status": "simulated_success",
            "risk_level": runbook.get("risk_level", "unknown"),
            "message": "MVP safety mode: no real infrastructure was modified.",
            "executed_steps": runbook.get("steps", []),
        }
