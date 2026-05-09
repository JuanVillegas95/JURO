package com.orahub.juro.problem.dto;

import com.orahub.juro.problem.model.ProblemDifficulty;
import com.orahub.juro.problem.model.ProblemType;
import com.orahub.juro.review.model.ReviewResult;
import com.orahub.juro.review.model.ReviewStatus;
import com.orahub.juro.review.model.ReviewTrack;
import com.orahub.juro.submission.model.SubmissionStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ProblemBankExportResponse(
        String format,
        int version,
        Instant exportedAt,
        List<ProblemBankProblem> problems
) {

    public record ProblemBankProblem(
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
            List<ProblemBankExample> examples,
            List<ProblemBankTestCase> testCases,
            List<ProblemBankReviewState> reviewStates,
            List<ProblemBankSubmission> submissions
    ) {
    }

    public record ProblemBankExample(
            String label,
            int sortOrder,
            String inputData,
            String expectedOutput,
            String explanation
    ) {
    }

    public record ProblemBankTestCase(
            String label,
            int sortOrder,
            String inputData,
            String expectedOutput,
            boolean hidden,
            String explanation
    ) {
    }

    public record ProblemBankReviewState(
            ReviewTrack track,
            ReviewStatus status,
            Instant dueAt,
            Instant lastReviewedAt,
            int intervalDays,
            double easeFactor,
            int repetitions,
            int lapses,
            ReviewResult lastResult,
            double priorityScore
    ) {
    }

    public record ProblemBankSubmission(
            String submittedLanguage,
            String sourceCode,
            SubmissionStatus status,
            String resultSummary,
            Long totalRuntimeMillis,
            String resultDetailsJson,
            Instant createdAt
    ) {
    }
}
