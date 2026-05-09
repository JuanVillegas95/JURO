package com.orahub.juro.localworkspace;

import java.time.Instant;
import java.util.UUID;

public record LocalProblemWorkspaceResponse(
        UUID problemId,
        String title,
        String slug,
        String scaffoldPath,
        String editor,
        boolean opened,
        String status,
        Long processId,
        boolean closeDetectionAvailable,
        Instant launchedAt,
        String message
) {
}
