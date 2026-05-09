package com.orahub.juro.problem.dto;

import com.orahub.juro.problem.model.ProblemDifficulty;
import com.orahub.juro.problem.model.ProblemType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ProblemDetailResponse(
        UUID id,
        String slug,
        String title,
        String summary,
        String descriptionMarkdown,
        String constraintsMarkdown,
        ProblemType type,
        ProblemDifficulty difficulty,
        String starterCode,
        String referenceSolution,
        String evaluationNotes,
        String solutionVideoUrl,
        String knowledgeRubric,
        Instant createdAt,
        Instant updatedAt,
        List<ProblemExampleResponse> examples,
        List<ProblemTestCaseResponse> testCases
) {
}
