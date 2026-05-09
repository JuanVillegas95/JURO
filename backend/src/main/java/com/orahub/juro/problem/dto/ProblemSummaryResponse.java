package com.orahub.juro.problem.dto;

import com.orahub.juro.problem.model.ProblemDifficulty;
import com.orahub.juro.problem.model.ProblemType;
import com.orahub.juro.review.dto.ReviewStateResponse;

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
        int testCaseCount,
        String solutionVideoUrl,
        ReviewStateResponse codingReview,
        ReviewStateResponse explanationReview,
        Instant createdAt,
        Instant updatedAt
) {
}
