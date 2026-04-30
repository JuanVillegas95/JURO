package com.orahub.juro.submission;

public record ExampleJudgeOutcome(
        String label,
        boolean passed,
        String inputData,
        String expectedOutput,
        String actualOutput,
        String note,
        long runtimeMillis
) {
}
