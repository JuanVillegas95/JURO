package com.orahub.juro.submission.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateSubmissionRequest(
        @NotBlank String submittedLanguage,
        @NotBlank String sourceCode
) {
}
