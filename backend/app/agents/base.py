import time
from dataclasses import dataclass
from typing import Callable, Any
from app.metrics import AGENT_LATENCY


@dataclass
class AgentRun:
    agent_name: str
    status: str
    latency_ms: float
    input_summary: str
    output_summary: str
    output: Any


def run_agent(agent_name: str, input_summary: str, fn: Callable[[], Any], output_summary_fn: Callable[[Any], str]) -> AgentRun:
    start = time.perf_counter()
    status = "success"
    try:
        output = fn()
    except Exception as exc:  # defensive telemetry wrapper
        status = "failed"
        output = {"error": str(exc)}
    latency_ms = round((time.perf_counter() - start) * 1000, 2)
    AGENT_LATENCY.labels(agent=agent_name).observe(latency_ms / 1000)
    return AgentRun(agent_name, status, latency_ms, input_summary, output_summary_fn(output), output)
