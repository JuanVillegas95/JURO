package com.orahub.juro.localworkspace;

public record LocalProblemCaseResult(
        String label,
        boolean passed,
        String inputData,
        String expectedOutput,
        String actualOutput,
        String note,
        long runtimeMillis
) {
}
