package com.orahub.juro.submission;

import jakarta.validation.constraints.NotBlank;

public record CreateSubmissionRequest(
        @NotBlank String submittedLanguage,
        @NotBlank String sourceCode
) {
}
