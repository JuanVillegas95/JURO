package com.orahub.juro.problem.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

public record ProblemExampleRequest(
        @NotBlank String label,
        @PositiveOrZero int sortOrder,
        @NotBlank String inputData,
        @NotBlank String expectedOutput,
        String explanation
) {
}
