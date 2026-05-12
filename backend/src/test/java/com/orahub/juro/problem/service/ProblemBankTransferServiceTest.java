package com.orahub.juro.problem.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orahub.juro.localworkspace.LocalSettingsService;
import com.orahub.juro.localworkspace.LocalWorkspaceSettings;
import com.orahub.juro.localworkspace.SaveLocalWorkspaceSettingsRequest;
import com.orahub.juro.problem.dto.ProblemBankExportResponse;
import com.orahub.juro.problem.dto.ProblemBankExportResponse.ProblemBankProblem;
import com.orahub.juro.problem.dto.ProblemBankExportResponse.ProblemBankReviewState;
import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.repository.ProblemRepository;
import com.orahub.juro.review.model.ReviewStatus;
import com.orahub.juro.review.model.ReviewTrack;
import com.orahub.juro.review.repository.ProblemReviewStateRepository;
import com.orahub.juro.submission.model.Submission;
import com.orahub.juro.submission.model.SubmissionStatus;
import com.orahub.juro.submission.repository.SubmissionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.profiles.active=desktop",
                "spring.datasource.url=jdbc:h2:mem:problemBankTransfer;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
                "spring.datasource.username=sa",
                "spring.datasource.password=",
                "spring.flyway.locations=classpath:db/desktop-migration",
                "app.local.settings-path=target/tmp/problem-bank-transfer-settings-${random.uuid}.json",
                "app.problem-bank.file-sync.poll-ms=3600000"
        }
)
class ProblemBankTransferServiceTest {

    @Autowired
    private ProblemBankTransferService transferService;

    @Autowired
    private ProblemBankFileSyncService fileSyncService;

    @Autowired
    private LocalSettingsService settingsService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ProblemRepository problemRepository;

    @Autowired
    private ProblemReviewStateRepository reviewStateRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Test
    void importRestoresReviewDueDatesAndSubmissionHistory() {
        Problem problem = problemRepository.findAll().get(0);
        Instant submissionCreatedAt = Instant.parse("2025-01-03T10:15:30Z");
        Submission submission = new Submission();
        submission.setProblem(problem);
        submission.setSubmittedLanguage("JAVA");
        submission.setSourceCode("class Solution {}");
        submission.setStatus(SubmissionStatus.ACCEPTED);
        submission.setResultSummary("Accepted");
        submission.setTotalRuntimeMillis(42L);
        submission.setResultDetailsJson("[]");
        submission.setCreatedAt(submissionCreatedAt);
        submissionRepository.save(submission);

        ProblemBankExportResponse exported = transferService.exportProblemBank();
        ProblemBankProblem exportedProblem = exported.problems().stream()
                .filter(candidate -> candidate.slug().equals(problem.getSlug()))
                .findFirst()
                .orElseThrow();
        Instant restoredDueAt = Instant.parse("2031-06-15T08:00:00Z");
        List<ProblemBankReviewState> restoredReviewStates = exportedProblem.reviewStates().stream()
                .map(state -> state.track() == ReviewTrack.CODING
                        ? new ProblemBankReviewState(
                        state.track(),
                        ReviewStatus.REVIEW,
                        restoredDueAt,
                        state.lastReviewedAt(),
                        11,
                        state.easeFactor(),
                        state.repetitions(),
                        state.lapses(),
                        state.lastResult(),
                        state.priorityScore()
                )
                        : state)
                .toList();
        ProblemBankProblem restoredProblem = new ProblemBankProblem(
                exportedProblem.id(),
                exportedProblem.slug(),
                exportedProblem.title(),
                exportedProblem.summary(),
                exportedProblem.descriptionMarkdown(),
                exportedProblem.constraintsMarkdown(),
                exportedProblem.type(),
                exportedProblem.difficulty(),
                exportedProblem.starterCode(),
                exportedProblem.referenceSolution(),
                exportedProblem.evaluationNotes(),
                exportedProblem.solutionVideoUrl(),
                exportedProblem.knowledgeRubric(),
                exportedProblem.createdAt(),
                exportedProblem.updatedAt(),
                exportedProblem.examples(),
                exportedProblem.testCases(),
                restoredReviewStates,
                exportedProblem.submissions()
        );

        var result = transferService.importProblemBank(new ProblemBankExportResponse(
                ProblemBankTransferService.FORMAT,
                ProblemBankTransferService.VERSION,
                Instant.now(),
                List.of(restoredProblem)
        ));

        assertThat(result.created()).isZero();
        assertThat(result.updated()).isEqualTo(1);
        assertThat(result.reviewStatesImported()).isEqualTo(2);
        assertThat(result.submissionsImported()).isEqualTo(1);
        assertThat(reviewStateRepository.findByProblem_IdAndTrack(problem.getId(), ReviewTrack.CODING))
                .hasValueSatisfying(state -> {
                    assertThat(state.getStatus()).isEqualTo(ReviewStatus.REVIEW);
                    assertThat(state.getDueAt()).isEqualTo(restoredDueAt);
                    assertThat(state.getIntervalDays()).isEqualTo(11);
                });
        assertThat(submissionRepository.findAllByProblem_IdOrderByCreatedAtDesc(problem.getId()))
                .singleElement()
                .satisfies(restoredSubmission -> {
                    assertThat(restoredSubmission.getStatus()).isEqualTo(SubmissionStatus.ACCEPTED);
                    assertThat(restoredSubmission.getCreatedAt()).isEqualTo(submissionCreatedAt);
                });
    }

    @Test
    void fileSyncImportsChangedJsonSnapshot() throws IOException {
        Path directory = Files.createDirectories(Path.of(
                "target",
                "tmp",
                "problem-bank-live-sync",
                UUID.randomUUID().toString()
        ));
        Path syncFile = directory.resolve("bank.json");
        saveSyncSettings(syncFile);

        Problem problem = problemRepository.findAll().get(0);
        ProblemBankExportResponse exported = transferService.exportProblemBank();
        ProblemBankProblem exportedProblem = exported.problems().stream()
                .filter(candidate -> candidate.slug().equals(problem.getSlug()))
                .findFirst()
                .orElseThrow();
        ProblemBankProblem editedProblem = new ProblemBankProblem(
                exportedProblem.id(),
                exportedProblem.slug(),
                "Two Sum Live JSON Edit",
                exportedProblem.summary(),
                exportedProblem.descriptionMarkdown(),
                exportedProblem.constraintsMarkdown(),
                exportedProblem.type(),
                exportedProblem.difficulty(),
                exportedProblem.starterCode(),
                exportedProblem.referenceSolution(),
                exportedProblem.evaluationNotes(),
                exportedProblem.solutionVideoUrl(),
                exportedProblem.knowledgeRubric(),
                exportedProblem.createdAt(),
                exportedProblem.updatedAt(),
                exportedProblem.examples(),
                exportedProblem.testCases(),
                exportedProblem.reviewStates(),
                exportedProblem.submissions()
        );

        objectMapper.writerWithDefaultPrettyPrinter().writeValue(syncFile.toFile(), new ProblemBankExportResponse(
                ProblemBankTransferService.FORMAT,
                ProblemBankTransferService.VERSION,
                Instant.now(),
                List.of(editedProblem)
        ));

        var status = fileSyncService.importNow();

        assertThat(status.lastError()).isNull();
        assertThat(status.synced()).isTrue();
        assertThat(problemRepository.findBySlug(problem.getSlug()))
                .hasValueSatisfying(updated -> assertThat(updated.getTitle()).isEqualTo("Two Sum Live JSON Edit"));
    }

    private void saveSyncSettings(Path syncFile) {
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();
        settingsService.saveSettings(new SaveLocalWorkspaceSettingsRequest(
                defaults.workspaceDirectory(),
                defaults.editor(),
                defaults.customEditorCommand(),
                defaults.aiProvider(),
                defaults.aiBaseUrl(),
                defaults.aiModel(),
                defaults.aiApiKey(),
                defaults.ollamaBaseUrl(),
                defaults.ollamaModel(),
                defaults.transcriptionProvider(),
                defaults.schedulerAlgorithm(),
                defaults.reviewIntensity(),
                defaults.codeReviewFrequency(),
                defaults.explanationReviewFrequency(),
                defaults.practiceFocus(),
                defaults.minimumIntervalDays(),
                defaults.maximumCodingIntervalDays(),
                defaults.maximumExplanationIntervalDays(),
                true,
                syncFile.toString()
        ));
    }
}
