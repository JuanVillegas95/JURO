package com.orahub.juro.submission.judge;

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
