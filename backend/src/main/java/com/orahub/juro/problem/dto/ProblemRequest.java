package com.orahub.juro.problem.dto;

import com.orahub.juro.problem.model.ProblemDifficulty;
import com.orahub.juro.problem.model.ProblemType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

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
        @NotBlank String solutionVideoUrl,
        @NotBlank @Size(min = 50, message = "must be at least 50 characters") String knowledgeRubric,
        @NotNull @Size(min = 3, message = "must include at least 3 examples") List<@Valid ProblemExampleRequest> examples,
        @NotNull @Size(min = 3, message = "must include at least 3 test cases") List<@Valid ProblemTestCaseRequest> testCases
) {
}
