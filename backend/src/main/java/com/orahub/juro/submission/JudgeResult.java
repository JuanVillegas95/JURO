package com.orahub.juro.submission;

public record JudgeResult(
        SubmissionStatus status,
        String summary,
        Long totalRuntimeMillis,
        java.util.List<SubmissionCaseResultResponse> caseResults
) {
}
