class EvaluationService:
    def evaluate_rca(self, predicted_root_cause: str, expected_root_cause: str) -> dict:
        predicted_words = set(predicted_root_cause.lower().split())
        expected_words = set(expected_root_cause.lower().split())
        overlap = predicted_words.intersection(expected_words)
        score = len(overlap) / max(len(expected_words), 1)
        return {
            "rca_correctness_score": round(score, 3),
            "overlapping_terms": sorted(overlap),
            "evaluation_type": "keyword_overlap_mvp",
        }
