package com.orahub.juro.problem;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ProblemDetailResponse(
        UUID id,
        String slug,
        String title,
        String summary,
        String descriptionMarkdown,
        String constraintsMarkdown,
        ProblemType type,
        ProblemDifficulty difficulty,
        String starterCode,
        String referenceSolution,
        String evaluationNotes,
        Instant createdAt,
        Instant updatedAt,
        List<ProblemExampleResponse> examples
) {
}
