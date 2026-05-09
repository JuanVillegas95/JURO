package com.orahub.juro.submission.judge;

import com.orahub.juro.submission.dto.SubmissionCaseResultResponse;
import com.orahub.juro.submission.model.SubmissionStatus;

import java.util.List;

final class JudgeResultFormatter {

    private JudgeResultFormatter() {
    }

    static JudgeResult fromExampleRuns(List<ExampleJudgeOutcome> outcomes) {
        long passedCount = outcomes.stream().filter(ExampleJudgeOutcome::passed).count();
        long totalRuntimeMillis = outcomes.stream().mapToLong(ExampleJudgeOutcome::runtimeMillis).sum();
        boolean accepted = passedCount == outcomes.size();

        StringBuilder builder = new StringBuilder();
        builder.append(accepted ? "Accepted" : "Rejected")
                .append(". Passed ")
                .append(passedCount)
                .append("/")
                .append(outcomes.size())
                .append(" example runs. Total runtime: ")
                .append(totalRuntimeMillis)
                .append(" ms.");

        for (ExampleJudgeOutcome outcome : outcomes) {
            builder.append("\n\n")
                    .append(outcome.label())
                    .append(" - ")
                    .append(outcome.passed() ? "Correct" : "Incorrect")
                    .append("\nInput:\n")
                    .append(outcome.inputData())
                    .append("\nExpected:\n")
                    .append(outcome.expectedOutput())
                    .append("\nActual:\n")
                    .append(outcome.actualOutput())
                    .append("\nRuntime:\n")
                    .append(outcome.runtimeMillis())
                    .append(" ms")
                    .append("\nNotes:\n")
                    .append(outcome.note());
        }

        List<SubmissionCaseResultResponse> caseResults = outcomes.stream()
                .map(outcome -> new SubmissionCaseResultResponse(
                        outcome.label(),
                        outcome.passed(),
                        outcome.inputData(),
                        outcome.expectedOutput(),
                        outcome.actualOutput(),
                        outcome.note(),
                        outcome.runtimeMillis()
                ))
                .toList();

        return new JudgeResult(
                accepted ? SubmissionStatus.ACCEPTED : SubmissionStatus.REJECTED,
                builder.toString(),
                totalRuntimeMillis,
                caseResults
        );
    }

    static JudgeResult failure(String title, String details) {
        String summary = details == null || details.isBlank()
                ? title
                : "%s%n%n%s".formatted(title, details);
        return new JudgeResult(SubmissionStatus.REJECTED, summary, null, List.of());
    }
}
