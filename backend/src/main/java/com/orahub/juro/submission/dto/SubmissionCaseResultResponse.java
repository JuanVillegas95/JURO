package com.orahub.juro.submission.dto;

public record SubmissionCaseResultResponse(
        String label,
        boolean passed,
        String inputData,
        String expectedOutput,
        String actualOutput,
        String note,
        long runtimeMillis
) {
}
