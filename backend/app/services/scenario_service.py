from app.data.scenarios import SCENARIOS


def list_scenarios() -> list[dict]:
    return [
        {
            "key": key,
            "title": value["title"],
            "service_name": value["service_name"],
            "severity": value["severity"],
            "description": value["description"],
        }
        for key, value in SCENARIOS.items()
    ]


def get_scenario(key: str) -> dict | None:
    return SCENARIOS.get(key)
