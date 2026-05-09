package com.orahub.juro.review.dto;

import com.orahub.juro.review.model.ReviewResult;
import com.orahub.juro.review.model.ReviewStatus;
import com.orahub.juro.review.model.ReviewTrack;

import java.time.Instant;

public record ReviewStateResponse(
        ReviewTrack track,
        ReviewStatus status,
        Instant dueAt,
        Instant lastReviewedAt,
        int intervalDays,
        double easeFactor,
        int repetitions,
        int lapses,
        ReviewResult lastResult,
        double priorityScore
) {
}
