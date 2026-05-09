package com.orahub.juro.problem.service;

import com.orahub.juro.problem.dto.ProblemBankExportResponse;
import com.orahub.juro.problem.dto.ProblemBankExportResponse.ProblemBankExample;
import com.orahub.juro.problem.dto.ProblemBankExportResponse.ProblemBankProblem;
import com.orahub.juro.problem.dto.ProblemBankExportResponse.ProblemBankReviewState;
import com.orahub.juro.problem.dto.ProblemBankExportResponse.ProblemBankSubmission;
import com.orahub.juro.problem.dto.ProblemBankExportResponse.ProblemBankTestCase;
import com.orahub.juro.problem.dto.ProblemBankImportResponse;
import com.orahub.juro.problem.dto.ProblemExampleRequest;
import com.orahub.juro.problem.dto.ProblemRequest;
import com.orahub.juro.problem.dto.ProblemTestCaseRequest;
import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.model.ProblemExample;
import com.orahub.juro.problem.model.ProblemTestCase;
import com.orahub.juro.problem.repository.ProblemRepository;
import com.orahub.juro.review.model.ProblemReviewState;
import com.orahub.juro.review.model.ReviewTrack;
import com.orahub.juro.review.repository.ProblemReviewStateRepository;
import com.orahub.juro.review.service.ProblemReviewService;
import com.orahub.juro.submission.model.Submission;
import com.orahub.juro.submission.repository.SubmissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Transactional
public class ProblemBankTransferService {

    public static final String FORMAT = "juro.problem-bank";
    public static final int VERSION = 1;

    private final ProblemRepository problemRepository;
    private final ProblemService problemService;
    private final ProblemReviewService reviewService;
    private final ProblemReviewStateRepository reviewStateRepository;
    private final SubmissionRepository submissionRepository;

    public ProblemBankTransferService(
            ProblemRepository problemRepository,
            ProblemService problemService,
            ProblemReviewService reviewService,
            ProblemReviewStateRepository reviewStateRepository,
            SubmissionRepository submissionRepository
    ) {
        this.problemRepository = problemRepository;
        this.problemService = problemService;
        this.reviewService = reviewService;
        this.reviewStateRepository = reviewStateRepository;
        this.submissionRepository = submissionRepository;
    }

    public ProblemBankExportResponse exportProblemBank() {
        List<ProblemBankProblem> problems = problemRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toExportProblem)
                .toList();
        return new ProblemBankExportResponse(FORMAT, VERSION, Instant.now(), problems);
    }

    public ProblemBankImportResponse importProblemBank(ProblemBankExportResponse snapshot) {
        validateSnapshot(snapshot);

        int created = 0;
        int updated = 0;
        int reviewStatesImported = 0;
        int submissionsImported = 0;

        for (ProblemBankProblem importedProblem : snapshot.problems()) {
            validateProblem(importedProblem);

            ProblemRequest request = toProblemRequest(importedProblem);
            var existingProblem = problemRepository.findBySlug(importedProblem.slug());
            Problem problem;
            if (existingProblem.isPresent()) {
                problemService.updateProblem(existingProblem.get().getId(), request);
                problem = problemRepository.findDetailedById(existingProblem.get().getId()).orElseThrow();
                updated++;
            } else {
                var createdProblem = problemService.createProblem(request);
                problem = problemRepository.findDetailedById(createdProblem.id()).orElseThrow();
                created++;
            }

            reviewStatesImported += replaceReviewStates(problem, importedProblem.reviewStates());
            submissionsImported += replaceSubmissions(problem, importedProblem.submissions());
        }

        return new ProblemBankImportResponse(created, updated, reviewStatesImported, submissionsImported);
    }

    private ProblemBankProblem toExportProblem(Problem problem) {
        reviewService.ensureStates(problem);

        List<ProblemBankExample> examples = problem.getExamples().stream()
                .sorted(Comparator.comparingInt(ProblemExample::getSortOrder))
                .map(example -> new ProblemBankExample(
                        example.getLabel(),
                        example.getSortOrder(),
                        example.getInputData(),
                        example.getExpectedOutput(),
                        example.getExplanation()
                ))
                .toList();
        List<ProblemBankTestCase> testCases = problem.getTestCases().stream()
                .sorted(Comparator.comparingInt(ProblemTestCase::getSortOrder))
                .map(testCase -> new ProblemBankTestCase(
                        testCase.getLabel(),
                        testCase.getSortOrder(),
                        testCase.getInputData(),
                        testCase.getExpectedOutput(),
                        testCase.isHidden(),
                        testCase.getExplanation()
                ))
                .toList();
        List<ProblemBankReviewState> reviewStates = reviewStateRepository.findAllByProblem_Id(problem.getId()).stream()
                .sorted(Comparator.comparing(state -> state.getTrack().name()))
                .map(state -> new ProblemBankReviewState(
                        state.getTrack(),
                        state.getStatus(),
                        state.getDueAt(),
                        state.getLastReviewedAt(),
                        state.getIntervalDays(),
                        state.getEaseFactor(),
                        state.getRepetitions(),
                        state.getLapses(),
                        state.getLastResult(),
                        state.getPriorityScore()
                ))
                .toList();
        List<ProblemBankSubmission> submissions = submissionRepository.findAllByProblem_IdOrderByCreatedAtDesc(problem.getId()).stream()
                .map(submission -> new ProblemBankSubmission(
                        submission.getSubmittedLanguage(),
                        submission.getSourceCode(),
                        submission.getStatus(),
                        submission.getResultSummary(),
                        submission.getTotalRuntimeMillis(),
                        submission.getResultDetailsJson(),
                        submission.getCreatedAt()
                ))
                .toList();

        return new ProblemBankProblem(
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
                examples,
                testCases,
                reviewStates,
                submissions
        );
    }

    private ProblemRequest toProblemRequest(ProblemBankProblem problem) {
        return new ProblemRequest(
                problem.title(),
                problem.slug(),
                problem.summary(),
                problem.descriptionMarkdown(),
                problem.constraintsMarkdown(),
                problem.type(),
                problem.difficulty(),
                problem.starterCode(),
                problem.referenceSolution(),
                problem.evaluationNotes(),
                problem.solutionVideoUrl(),
                problem.knowledgeRubric(),
                problem.examples().stream()
                        .map(example -> new ProblemExampleRequest(
                                example.label(),
                                example.sortOrder(),
                                example.inputData(),
                                example.expectedOutput(),
                                example.explanation()
                        ))
                        .toList(),
                problem.testCases().stream()
                        .map(testCase -> new ProblemTestCaseRequest(
                                testCase.label(),
                                testCase.sortOrder(),
                                testCase.inputData(),
                                testCase.expectedOutput(),
                                testCase.hidden(),
                                testCase.explanation()
                        ))
                        .toList()
        );
    }

    private int replaceReviewStates(Problem problem, List<ProblemBankReviewState> importedStates) {
        if (importedStates == null || importedStates.isEmpty()) {
            reviewService.ensureStates(problem);
            return 0;
        }

        reviewService.ensureStates(problem);
        Map<ReviewTrack, ProblemReviewState> statesByTrack = new EnumMap<>(ReviewTrack.class);
        reviewStateRepository.findAllByProblem_Id(problem.getId())
                .forEach(state -> statesByTrack.put(state.getTrack(), state));

        int imported = 0;
        for (ProblemBankReviewState importedState : importedStates) {
            if (importedState.track() == null || importedState.status() == null || importedState.dueAt() == null) {
                throw new IllegalArgumentException("Imported review states must include track, status, and dueAt.");
            }
            ProblemReviewState state = statesByTrack.get(importedState.track());
            if (state == null) {
                state = new ProblemReviewState();
                state.setProblem(problem);
                state.setTrack(importedState.track());
            }
            state.setStatus(importedState.status());
            state.setDueAt(importedState.dueAt());
            state.setLastReviewedAt(importedState.lastReviewedAt());
            state.setIntervalDays(Math.max(0, importedState.intervalDays()));
            state.setEaseFactor(Math.max(1.3d, importedState.easeFactor()));
            state.setRepetitions(Math.max(0, importedState.repetitions()));
            state.setLapses(Math.max(0, importedState.lapses()));
            state.setLastResult(importedState.lastResult());
            state.setPriorityScore(Math.max(0.0d, importedState.priorityScore()));
            reviewStateRepository.save(state);
            imported++;
        }

        return imported;
    }

    private int replaceSubmissions(Problem problem, List<ProblemBankSubmission> importedSubmissions) {
        if (importedSubmissions == null) {
            return 0;
        }

        submissionRepository.deleteAllByProblem_Id(problem.getId());
        if (importedSubmissions.isEmpty()) {
            return 0;
        }

        int imported = 0;
        for (ProblemBankSubmission importedSubmission : importedSubmissions) {
            validateSubmission(importedSubmission);

            Submission submission = new Submission();
            submission.setProblem(problem);
            submission.setSubmittedLanguage(importedSubmission.submittedLanguage().trim().toUpperCase(Locale.ROOT));
            submission.setSourceCode(importedSubmission.sourceCode().trim());
            submission.setStatus(importedSubmission.status());
            submission.setResultSummary(importedSubmission.resultSummary().trim());
            submission.setTotalRuntimeMillis(importedSubmission.totalRuntimeMillis());
            submission.setResultDetailsJson(importedSubmission.resultDetailsJson());
            submission.setCreatedAt(importedSubmission.createdAt());
            submissionRepository.save(submission);
            imported++;
        }
        return imported;
    }

    private void validateSnapshot(ProblemBankExportResponse snapshot) {
        if (snapshot == null) {
            throw new IllegalArgumentException("Import file is empty.");
        }
        if (!FORMAT.equals(snapshot.format()) || snapshot.version() != VERSION) {
            throw new IllegalArgumentException("Import file is not a supported JURO problem bank export.");
        }
        if (snapshot.exportedAt() == null) {
            throw new IllegalArgumentException("Import file is missing exportedAt.");
        }
        if (snapshot.problems() == null) {
            throw new IllegalArgumentException("Import file is missing problems.");
        }
    }

    private void validateProblem(ProblemBankProblem problem) {
        if (problem == null) {
            throw new IllegalArgumentException("Import file contains an empty problem.");
        }
        if (isBlank(problem.slug())) {
            throw new IllegalArgumentException("Imported problems must include a slug.");
        }
        if (problem.examples() == null || problem.examples().size() < 3) {
            throw new IllegalArgumentException("Imported problem %s must include at least 3 examples.".formatted(problem.slug()));
        }
        if (problem.testCases() == null || problem.testCases().size() < 3) {
            throw new IllegalArgumentException("Imported problem %s must include at least 3 test cases.".formatted(problem.slug()));
        }
        if (problem.reviewStates() == null || problem.reviewStates().isEmpty()) {
            throw new IllegalArgumentException("Imported problem %s must include review states.".formatted(problem.slug()));
        }
        EnumSet<ReviewTrack> importedTracks = EnumSet.noneOf(ReviewTrack.class);
        problem.reviewStates().stream()
                .map(ProblemBankReviewState::track)
                .filter(track -> track != null)
                .forEach(importedTracks::add);
        if (!importedTracks.containsAll(List.of(ReviewTrack.CODING, ReviewTrack.EXPLANATION))) {
            throw new IllegalArgumentException("Imported problem %s must include coding and explanation due dates.".formatted(problem.slug()));
        }
        if (problem.submissions() == null) {
            throw new IllegalArgumentException("Imported problem %s must include submissions.".formatted(problem.slug()));
        }
    }

    private void validateSubmission(ProblemBankSubmission submission) {
        if (submission == null) {
            throw new IllegalArgumentException("Import file contains an empty submission.");
        }
        if (isBlank(submission.submittedLanguage()) || isBlank(submission.sourceCode()) || submission.status() == null) {
            throw new IllegalArgumentException("Imported submissions must include language, sourceCode, and status.");
        }
        if (isBlank(submission.resultSummary())) {
            throw new IllegalArgumentException("Imported submissions must include resultSummary.");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
