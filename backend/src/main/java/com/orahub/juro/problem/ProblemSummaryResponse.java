package com.orahub.juro.problem;

import java.time.Instant;
import java.util.UUID;

public record ProblemSummaryResponse(
        UUID id,
        String slug,
        String title,
        String summary,
        ProblemType type,
        ProblemDifficulty difficulty,
        int exampleCount,
        Instant createdAt,
        Instant updatedAt
) {
}
