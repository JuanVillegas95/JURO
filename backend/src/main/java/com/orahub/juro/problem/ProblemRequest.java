package com.orahub.juro.problem;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ProblemRequest(
        @NotBlank String title,
        String slug,
        @NotBlank String summary,
        @NotBlank String descriptionMarkdown,
        String constraintsMarkdown,
        @NotNull ProblemType type,
        @NotNull ProblemDifficulty difficulty,
        String starterCode,
        String referenceSolution,
        String evaluationNotes,
        @NotEmpty List<@Valid ProblemExampleRequest> examples
) {
}
