package com.orahub.juro.problem.dto;

import java.time.Instant;

public record ProblemBankFileSyncStatus(
        boolean enabled,
        String filePath,
        boolean fileExists,
        Instant lastModifiedAt,
        Long fileSizeBytes,
        boolean importInProgress,
        Instant lastImportedAt,
        String lastImportSummary,
        String lastError,
        boolean synced
) {
}
