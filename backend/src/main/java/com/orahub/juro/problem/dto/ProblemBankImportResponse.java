package com.orahub.juro.problem.dto;

public record ProblemBankImportResponse(
        int created,
        int updated,
        int reviewStatesImported,
        int submissionsImported
) {
}
