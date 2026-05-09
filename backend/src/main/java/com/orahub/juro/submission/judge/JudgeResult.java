package com.orahub.juro.submission.judge;

import com.orahub.juro.submission.dto.SubmissionCaseResultResponse;
import com.orahub.juro.submission.model.SubmissionStatus;

public record JudgeResult(
        SubmissionStatus status,
        String summary,
        Long totalRuntimeMillis,
        java.util.List<SubmissionCaseResultResponse> caseResults
) {
}
