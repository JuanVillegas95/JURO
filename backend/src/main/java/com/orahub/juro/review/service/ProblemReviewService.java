package com.orahub.juro.review.service;

import com.orahub.juro.localworkspace.LocalSettingsService;
import com.orahub.juro.localworkspace.LocalWorkspaceSettings;
import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.review.dto.ReviewStateResponse;
import com.orahub.juro.review.model.ProblemReviewState;
import com.orahub.juro.review.model.ReviewResult;
import com.orahub.juro.review.model.ReviewStatus;
import com.orahub.juro.review.model.ReviewTrack;
import com.orahub.juro.review.repository.ProblemReviewStateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class ProblemReviewService {

    private static final double DEFAULT_EASE = 2.5d;
    private static final int EXPLANATION_PASS_SCORE = 70;

    private final ProblemReviewStateRepository reviewStateRepository;
    private final LocalSettingsService settingsService;
    private final ReviewScheduleCalculator scheduleCalculator;

    public ProblemReviewService(
            ProblemReviewStateRepository reviewStateRepository,
            LocalSettingsService settingsService,
            ReviewScheduleCalculator scheduleCalculator
    ) {
        this.reviewStateRepository = reviewStateRepository;
        this.settingsService = settingsService;
        this.scheduleCalculator = scheduleCalculator;
    }

    public Map<ReviewTrack, ReviewStateResponse> ensureStates(Problem problem) {
        List<ProblemReviewState> existing = reviewStateRepository.findAllByProblem_Id(problem.getId());
        Map<ReviewTrack, ProblemReviewState> byTrack = new EnumMap<>(ReviewTrack.class);
        existing.forEach(state -> byTrack.put(state.getTrack(), state));

        for (ReviewTrack track : ReviewTrack.values()) {
            byTrack.computeIfAbsent(track, missingTrack -> reviewStateRepository.save(newState(problem, missingTrack)));
        }

        Map<ReviewTrack, ReviewStateResponse> response = new EnumMap<>(ReviewTrack.class);
        byTrack.forEach((track, state) -> response.put(track, toResponse(refreshPriority(state, Instant.now()))));
        return response;
    }

    public ReviewStateResponse recordCodingResult(Problem problem, boolean passed) {
        return recordResult(problem, ReviewTrack.CODING, passed ? 4 : 1);
    }

    public ReviewStateResponse recordManualResult(Problem problem, ReviewTrack track, boolean passed) {
        return recordResult(problem, track, passed ? 4 : 1);
    }

    public ReviewStateResponse recordExplanationScore(Problem problem, int score) {
        int grade = score >= 90 ? 5 : score >= EXPLANATION_PASS_SCORE ? 4 : 1;
        return recordResult(problem, ReviewTrack.EXPLANATION, grade);
    }

    private ReviewStateResponse recordResult(Problem problem, ReviewTrack track, int grade) {
        ProblemReviewState state = reviewStateRepository
                .findByProblem_IdAndTrack(problem.getId(), track)
                .orElseGet(() -> newState(problem, track));

        Instant now = Instant.now();
        LocalWorkspaceSettings schedulingSettings = settingsService.getSettings();
        boolean passed = grade >= 3;
        if (!passed) {
            state.setLapses(state.getLapses() + 1);
            state.setRepetitions(0);
            state.setIntervalDays(scheduleCalculator.failedIntervalDays(track, schedulingSettings));
            state.setEaseFactor(Math.max(1.3d, state.getEaseFactor() - 0.2d));
            state.setStatus(ReviewStatus.LEARNING);
            state.setLastResult(ReviewResult.FAILED);
        } else {
            int repetitions = state.getRepetitions() + 1;
            int interval = scheduleCalculator.passedIntervalDays(
                    track,
                    repetitions,
                    state.getIntervalDays(),
                    state.getEaseFactor(),
                    grade,
                    schedulingSettings
            );
            state.setRepetitions(repetitions);
            state.setIntervalDays(interval);
            state.setEaseFactor(nextEase(state.getEaseFactor(), grade));
            state.setStatus(interval >= scheduleCalculator.masteryIntervalDays(track) ? ReviewStatus.MASTERED : ReviewStatus.REVIEW);
            state.setLastResult(ReviewResult.PASSED);
        }

        state.setLastReviewedAt(now);
        state.setDueAt(now.plus(Math.max(1, state.getIntervalDays()), ChronoUnit.DAYS));
        refreshPriority(state, now);
        return toResponse(reviewStateRepository.save(state));
    }

    private ProblemReviewState newState(Problem problem, ReviewTrack track) {
        ProblemReviewState state = new ProblemReviewState();
        state.setProblem(problem);
        state.setTrack(track);
        state.setStatus(ReviewStatus.NEW);
        state.setDueAt(Instant.now());
        state.setIntervalDays(0);
        state.setEaseFactor(DEFAULT_EASE);
        state.setRepetitions(0);
        state.setLapses(0);
        state.setPriorityScore(track == ReviewTrack.EXPLANATION ? 2.0d : 1.5d);
        return state;
    }

    private double nextEase(double currentEase, int grade) {
        double nextEase = currentEase + (0.1d - (5 - grade) * (0.08d + (5 - grade) * 0.02d));
        return Math.max(1.3d, Math.min(3.0d, nextEase));
    }

    private ProblemReviewState refreshPriority(ProblemReviewState state, Instant now) {
        long overdueHours = Duration.between(state.getDueAt(), now).toHours();
        double dueWeight = overdueHours >= 0 ? 10.0d + overdueHours / 24.0d : 1.0d / (1.0d + Math.abs(overdueHours) / 24.0d);
        double trackWeight = state.getTrack() == ReviewTrack.EXPLANATION ? 1.35d : 1.0d;
        double lapseWeight = 1.0d + state.getLapses() * 0.15d;
        state.setPriorityScore(Math.round(dueWeight * trackWeight * lapseWeight * 100.0d) / 100.0d);
        if (state.getDueAt().isBefore(now) && state.getStatus() != ReviewStatus.NEW) {
            state.setStatus(ReviewStatus.DUE);
        }
        return state;
    }

    private ReviewStateResponse toResponse(ProblemReviewState state) {
        return new ReviewStateResponse(
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
        );
    }
}
