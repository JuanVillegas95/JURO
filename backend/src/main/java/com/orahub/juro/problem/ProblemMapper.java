package com.orahub.juro.problem;

import java.util.Comparator;

public final class ProblemMapper {

    private ProblemMapper() {
    }

    public static ProblemSummaryResponse toSummary(Problem problem) {
        return new ProblemSummaryResponse(
                problem.getId(),
                problem.getSlug(),
                problem.getTitle(),
                problem.getSummary(),
                problem.getType(),
                problem.getDifficulty(),
                problem.getExamples().size(),
                problem.getCreatedAt(),
                problem.getUpdatedAt()
        );
    }

    public static ProblemDetailResponse toDetail(Problem problem) {
        return new ProblemDetailResponse(
                problem.getId(),
                problem.getSlug(),
                problem.getTitle(),
                problem.getSummary(),
                problem.getDescriptionMarkdown(),
                problem.getConstraintsMarkdown(),
                problem.getType(),
                problem.getDifficulty(),
                problem.getStarterCode(),
                problem.getReferenceSolution(),
                problem.getEvaluationNotes(),
                problem.getCreatedAt(),
                problem.getUpdatedAt(),
                problem.getExamples().stream()
                        .sorted(Comparator.comparingInt(ProblemExample::getSortOrder))
                        .map(ProblemMapper::toExample)
                        .toList()
        );
    }

    public static ProblemExampleResponse toExample(ProblemExample example) {
        return new ProblemExampleResponse(
                example.getId(),
                example.getLabel(),
                example.getSortOrder(),
                example.getInputData(),
                example.getExpectedOutput(),
                example.getExplanation(),
                example.getCreatedAt()
        );
    }
}
