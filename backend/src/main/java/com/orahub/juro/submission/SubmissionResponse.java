package com.orahub.juro.submission;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SubmissionResponse(
        UUID id,
        UUID problemId,
        String submittedLanguage,
        SubmissionStatus status,
        String resultSummary,
        Long totalRuntimeMillis,
        List<SubmissionCaseResultResponse> caseResults,
        Instant createdAt
) {
}
