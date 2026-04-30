package com.orahub.juro.submission;

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
