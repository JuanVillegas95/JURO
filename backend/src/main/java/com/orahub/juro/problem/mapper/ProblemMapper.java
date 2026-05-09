package com.orahub.juro.problem.mapper;

import com.orahub.juro.problem.dto.ProblemDetailResponse;
import com.orahub.juro.problem.dto.ProblemExampleResponse;
import com.orahub.juro.problem.dto.ProblemSummaryResponse;
import com.orahub.juro.problem.dto.ProblemTestCaseResponse;
import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.model.ProblemExample;
import com.orahub.juro.problem.model.ProblemTestCase;
import com.orahub.juro.review.dto.ReviewStateResponse;

import java.util.Comparator;

public final class ProblemMapper {

    private ProblemMapper() {
    }

    public static ProblemSummaryResponse toSummary(
            Problem problem,
            ReviewStateResponse codingReview,
            ReviewStateResponse explanationReview
    ) {
        return new ProblemSummaryResponse(
                problem.getId(),
                problem.getSlug(),
                problem.getTitle(),
                problem.getSummary(),
                problem.getType(),
                problem.getDifficulty(),
                problem.getExamples().size(),
                problem.getTestCases().size(),
                problem.getSolutionVideoUrl(),
                codingReview,
                explanationReview,
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
                problem.getSolutionVideoUrl(),
                problem.getKnowledgeRubric(),
                problem.getCreatedAt(),
                problem.getUpdatedAt(),
                problem.getExamples().stream()
                        .sorted(Comparator.comparingInt(ProblemExample::getSortOrder))
                        .map(ProblemMapper::toExample)
                        .toList(),
                problem.getTestCases().stream()
                        .sorted(Comparator.comparingInt(ProblemTestCase::getSortOrder))
                        .map(ProblemMapper::toTestCase)
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

    public static ProblemTestCaseResponse toTestCase(ProblemTestCase testCase) {
        return new ProblemTestCaseResponse(
                testCase.getId(),
                testCase.getLabel(),
                testCase.getSortOrder(),
                testCase.getInputData(),
                testCase.getExpectedOutput(),
                testCase.isHidden(),
                testCase.getExplanation(),
                testCase.getCreatedAt()
        );
    }
}
