package com.orahub.juro.submission.service;

import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.model.ProblemTestCase;
import com.orahub.juro.problem.model.ProblemType;
import com.orahub.juro.problem.service.ProblemService;
import com.orahub.juro.review.service.ProblemReviewService;
import com.orahub.juro.submission.dto.SubmissionCaseResultResponse;
import com.orahub.juro.submission.dto.SubmissionResponse;
import com.orahub.juro.submission.judge.JudgeResult;
import com.orahub.juro.submission.judge.SubmissionJudgeService;
import com.orahub.juro.submission.model.Submission;
import com.orahub.juro.submission.repository.SubmissionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class SubmissionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SubmissionService.class);

    private final SubmissionRepository submissionRepository;
    private final ProblemService problemService;
    private final SubmissionJudgeService submissionJudgeService;
    private final ObjectMapper objectMapper;
    private final ProblemReviewService reviewService;

    public SubmissionService(
            SubmissionRepository submissionRepository,
            ProblemService problemService,
            SubmissionJudgeService submissionJudgeService,
            ObjectMapper objectMapper,
            ProblemReviewService reviewService
    ) {
        this.submissionRepository = submissionRepository;
        this.problemService = problemService;
        this.submissionJudgeService = submissionJudgeService;
        this.objectMapper = objectMapper;
        this.reviewService = reviewService;
    }

    @Transactional(readOnly = true)
    public List<SubmissionResponse> listSubmissions(UUID problemId) {
        problemService.getProblemEntity(problemId);
        return submissionRepository.findAllByProblem_IdOrderByCreatedAtDesc(problemId).stream()
                .map(this::toResponse)
                .toList();
    }

    public SubmissionResponse createSubmission(UUID problemId, String submittedLanguage, String sourceCode) {
        String normalizedLanguage = normalizeSubmittedLanguage(submittedLanguage);
        String normalizedSourceCode = normalizeSourceCode(sourceCode);

        try {
            Problem problem = problemService.getProblemEntity(problemId);
            validateRunnableProblem(problem);
            JudgeResult judgeResult = submissionJudgeService.judge(problem, normalizedSourceCode);

            Submission submission = new Submission();
            submission.setProblem(problem);
            submission.setSubmittedLanguage(normalizedLanguage);
            submission.setSourceCode(normalizedSourceCode);
            submission.setStatus(judgeResult.status());
            submission.setResultSummary(judgeResult.summary());
            submission.setTotalRuntimeMillis(judgeResult.totalRuntimeMillis());
            submission.setResultDetailsJson(writeCaseResults(judgeResult.caseResults()));

            Submission saved = submissionRepository.save(submission);
            reviewService.recordCodingResult(problem, judgeResult.status() == com.orahub.juro.submission.model.SubmissionStatus.ACCEPTED);
            return toResponse(saved);
        } catch (RuntimeException exception) {
            LOGGER.error(
                    "Submission failed. problemId={} language={} codeSnippet={}",
                    problemId,
                    normalizedLanguage,
                    codeSnippet(normalizedSourceCode),
                    exception
            );
            throw exception;
        }
    }

    private String normalizeSubmittedLanguage(String submittedLanguage) {
        if (submittedLanguage == null || submittedLanguage.isBlank()) {
            throw new IllegalArgumentException("Submitted language is required.");
        }
        String normalized = submittedLanguage.trim().toUpperCase(Locale.ROOT);
        if (!normalized.equals(ProblemType.JAVA.name())) {
            throw new IllegalArgumentException("JURO currently accepts Java submissions only.");
        }
        return normalized;
    }

    private String normalizeSourceCode(String sourceCode) {
        if (sourceCode == null || sourceCode.isBlank()) {
            throw new IllegalArgumentException("Source code is required.");
        }
        return sourceCode.trim();
    }

    private void validateRunnableProblem(Problem problem) {
        if (problem.getType() == null) {
            throw new IllegalArgumentException("Problem %s is missing a language type.".formatted(problem.getId()));
        }
        if (problem.getType() != ProblemType.JAVA) {
            throw new IllegalArgumentException("JURO currently supports Java problems only.");
        }
        if (problem.getTestCases() == null || problem.getTestCases().size() < 3) {
            throw new IllegalArgumentException("Problem %s must have at least 3 runnable test cases.".formatted(problem.getId()));
        }

        for (ProblemTestCase testCase : problem.getTestCases()) {
            if (testCase.getInputData() == null || testCase.getInputData().isBlank()) {
                throw new IllegalArgumentException("Problem %s has an example with empty input data.".formatted(problem.getId()));
            }
            if (testCase.getExpectedOutput() == null || testCase.getExpectedOutput().isBlank()) {
                throw new IllegalArgumentException("Problem %s has an example with empty expected output.".formatted(problem.getId()));
            }
        }
    }

    private String codeSnippet(String sourceCode) {
        String compact = sourceCode.replaceAll("\\s+", " ");
        return compact.length() <= 160 ? compact : "%s...".formatted(compact.substring(0, 160));
    }

    private SubmissionResponse toResponse(Submission submission) {
        return new SubmissionResponse(
                submission.getId(),
                submission.getProblem().getId(),
                submission.getSubmittedLanguage(),
                submission.getStatus(),
                submission.getResultSummary(),
                submission.getTotalRuntimeMillis(),
                readCaseResults(submission.getResultDetailsJson()),
                submission.getCreatedAt()
        );
    }

    private String writeCaseResults(List<SubmissionCaseResultResponse> caseResults) {
        try {
            return objectMapper.writeValueAsString(caseResults == null ? List.of() : caseResults);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to serialize judge results.", exception);
        }
    }

    private List<SubmissionCaseResultResponse> readCaseResults(String resultDetailsJson) {
        if (resultDetailsJson == null || resultDetailsJson.isBlank()) {
            return List.of();
        }

        try {
            return objectMapper.readValue(resultDetailsJson, new TypeReference<>() {
            });
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read stored judge results.", exception);
        }
    }
}
