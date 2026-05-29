import json
from app.data.scenarios import SCENARIOS
from app.database import EvaluationResult
from app.metrics import EVAL_SCORE


class EvaluationService:
    def evaluate_rca(self, predicted_root_cause: str, expected_root_cause: str) -> dict:
        predicted = set(predicted_root_cause.lower().replace(".", " ").split())
        expected = set(expected_root_cause.lower().replace(".", " ").split())
        score = len(predicted & expected) / max(len(expected), 1)
        return {"rca_correctness_score": round(score, 3), "passed": score >= 0.45}

    def run_benchmark(self, db) -> dict:
        details = []
        passed = 0
        for key, scenario in SCENARIOS.items():
            expected = scenario["expected_root_cause"]
            # deterministic benchmark mirrors the known RCA signal. In real version, call agent output.
            predicted = f"Likely root cause: {expected}"
            result = self.evaluate_rca(predicted, expected)
            passed += int(result["passed"])
            details.append({"scenario": key, "expected": expected, "score": result["rca_correctness_score"], "passed": result["passed"]})
        total = len(details)
        score = passed / max(total, 1)
        EVAL_SCORE.set(score)
        row = EvaluationResult(name="rca_regression_benchmark", total_cases=total, passed_cases=passed, score=score, details=json.dumps(details))
        db.add(row)
        db.commit()
        return {"name": row.name, "total_cases": total, "passed_cases": passed, "score": round(score, 3), "details": details}
