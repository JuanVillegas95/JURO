package com.orahub.juro.localworkspace;

import java.util.List;
import java.util.UUID;

public record LocalProblemRunResponse(
        UUID problemId,
        String title,
        String slug,
        String scaffoldPath,
        String status,
        int exitCode,
        long runtimeMillis,
        String stdout,
        String stderr,
        List<LocalProblemCaseResult> caseResults
) {
}
