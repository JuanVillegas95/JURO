package com.orahub.juro.review.dto;

import com.orahub.juro.review.model.ReviewTrack;
import jakarta.validation.constraints.NotNull;

public record ReviewGradeRequest(
        @NotNull ReviewTrack track,
        @NotNull Boolean passed
) {
}
