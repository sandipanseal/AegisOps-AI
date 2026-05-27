class SafetyAgent:
    risky_keywords = ["delete", "drop", "terminate", "rollback", "scale down", "restart", "production"]

    def split_actions(self, actions: list[str]) -> tuple[list[str], list[str]]:
        safe: list[str] = []
        risky: list[str] = []
        for action in actions:
            normalized = action.lower()
            if any(keyword in normalized for keyword in self.risky_keywords):
                risky.append(action)
            else:
                safe.append(action)
        return safe, risky

    def requires_approval(self, actions: list[str]) -> bool:
        return bool(self.split_actions(actions)[1])
