package com.orahub.juro.knowledge.dto;

import java.time.Instant;
import java.util.List;

public record KnowledgeEvaluationResponse(
        String status,
        int score,
        String summary,
        List<String> missingConcepts,
        List<String> strengths,
        String suggestedReview,
        String model,
        Instant createdAt
) {
}
