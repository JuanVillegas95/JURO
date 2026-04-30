package com.orahub.juro.submission;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orahub.juro.problem.Problem;
import com.orahub.juro.problem.ProblemService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class SubmissionService {

    private final SubmissionRepository submissionRepository;
    private final ProblemService problemService;
    private final SubmissionJudgeService submissionJudgeService;
    private final ObjectMapper objectMapper;

    public SubmissionService(
            SubmissionRepository submissionRepository,
            ProblemService problemService,
            SubmissionJudgeService submissionJudgeService,
            ObjectMapper objectMapper
    ) {
        this.submissionRepository = submissionRepository;
        this.problemService = problemService;
        this.submissionJudgeService = submissionJudgeService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<SubmissionResponse> listSubmissions(UUID problemId) {
        problemService.getProblemEntity(problemId);
        return submissionRepository.findAllByProblem_IdOrderByCreatedAtDesc(problemId).stream()
                .map(this::toResponse)
                .toList();
    }

    public SubmissionResponse createSubmission(UUID problemId, CreateSubmissionRequest request) {
        Problem problem = problemService.getProblemEntity(problemId);
        String sourceCode = request.sourceCode().trim();
        JudgeResult judgeResult = submissionJudgeService.judge(problem, sourceCode);

        Submission submission = new Submission();
        submission.setProblem(problem);
        submission.setSubmittedLanguage(request.submittedLanguage().trim().toUpperCase(Locale.ROOT));
        submission.setSourceCode(sourceCode);
        submission.setStatus(judgeResult.status());
        submission.setResultSummary(judgeResult.summary());
        submission.setTotalRuntimeMillis(judgeResult.totalRuntimeMillis());
        submission.setResultDetailsJson(writeCaseResults(judgeResult.caseResults()));

        return toResponse(submissionRepository.save(submission));
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
