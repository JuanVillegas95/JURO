package com.orahub.juro.submission.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record RunSubmissionRequest(
        @NotNull UUID problemId,
        @NotBlank String language,
        @NotBlank String code
) {
}
