package com.orahub.juro.problem.dto;

import java.time.Instant;
import java.util.UUID;

public record ProblemTestCaseResponse(
        UUID id,
        String label,
        int sortOrder,
        String inputData,
        String expectedOutput,
        boolean hidden,
        String explanation,
        Instant createdAt
) {
}
