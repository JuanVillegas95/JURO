package com.orahub.juro.knowledge.dto;

import jakarta.validation.constraints.NotBlank;

public record KnowledgeEvaluationRequest(
        @NotBlank String transcript
) {
}
