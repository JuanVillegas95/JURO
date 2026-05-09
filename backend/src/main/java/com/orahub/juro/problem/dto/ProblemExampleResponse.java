package com.orahub.juro.problem.dto;

import java.time.Instant;
import java.util.UUID;

public record ProblemExampleResponse(
        UUID id,
        String label,
        int sortOrder,
        String inputData,
        String expectedOutput,
        String explanation,
        Instant createdAt
) {
}
