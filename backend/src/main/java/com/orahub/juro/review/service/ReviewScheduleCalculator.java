package com.orahub.juro.review.service;

import com.orahub.juro.localworkspace.LocalWorkspaceSettings;
import com.orahub.juro.review.model.ReviewTrack;
import org.springframework.stereotype.Service;

@Service
public class ReviewScheduleCalculator {

    public int passedIntervalDays(
            ReviewTrack track,
            int repetitions,
            int previousInterval,
            double easeFactor,
            int grade,
            LocalWorkspaceSettings settings
    ) {
        return applySettings(track, basePassedIntervalDays(track, repetitions, previousInterval, easeFactor, grade), settings);
    }

    public int failedIntervalDays(ReviewTrack track, LocalWorkspaceSettings settings) {
        return applySettings(track, track == ReviewTrack.EXPLANATION ? 1 : 2, settings);
    }

    public int masteryIntervalDays(ReviewTrack track) {
        return track == ReviewTrack.EXPLANATION ? 21 : 45;
    }

    int basePassedIntervalDays(ReviewTrack track, int repetitions, int previousInterval, double easeFactor, int grade) {
        if (track == ReviewTrack.EXPLANATION) {
            if (repetitions == 1) {
                return grade >= 5 ? 2 : 1;
            }
            if (repetitions == 2) {
                return grade >= 5 ? 4 : 3;
            }
            return Math.max(1, (int) Math.round(previousInterval * Math.max(1.35d, easeFactor * 0.72d)));
        }

        if (repetitions == 1) {
            return grade >= 5 ? 4 : 3;
        }
        if (repetitions == 2) {
            return grade >= 5 ? 10 : 7;
        }
        return Math.max(3, (int) Math.round(previousInterval * easeFactor));
    }

    int applySettings(ReviewTrack track, int baseIntervalDays, LocalWorkspaceSettings settings) {
        double multiplier = trackFrequencyMultiplier(track, settings);
        int minimumInterval = Math.max(1, settings.minimumIntervalDays());
        int maximumInterval = Math.max(
                minimumInterval,
                track == ReviewTrack.CODING ? settings.maximumCodingIntervalDays() : settings.maximumExplanationIntervalDays()
        );
        int adjustedInterval = Math.max(1, (int) Math.round(baseIntervalDays * multiplier));

        return Math.max(minimumInterval, Math.min(maximumInterval, adjustedInterval));
    }

    private double trackFrequencyMultiplier(ReviewTrack track, LocalWorkspaceSettings settings) {
        String frequency = track == ReviewTrack.CODING
                ? settings.codeReviewFrequency()
                : settings.explanationReviewFrequency();

        if (track == ReviewTrack.CODING) {
            return switch (frequency) {
                case "LESS_OFTEN" -> 1.5d;
                case "MORE_OFTEN" -> 0.75d;
                default -> 1.0d;
            };
        }

        return switch (frequency) {
            case "LESS_OFTEN" -> 1.25d;
            case "MORE_OFTEN" -> 0.65d;
            default -> 1.0d;
        };
    }
}
