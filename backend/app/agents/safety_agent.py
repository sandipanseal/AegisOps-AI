class SafetyAgent:
    risky_keywords = ["restart", "rollback", "delete", "drop", "terminate", "scale down", "production"]

    def classify(self, actions: list[str]) -> dict:
        safe, risky = [], []
        for action in actions:
            target = risky if any(word in action.lower() for word in self.risky_keywords) else safe
            target.append(action)
        return {"safe": safe, "risky": risky, "requires_approval": bool(risky)}
