package com.orahub.juro.review.service;

import com.orahub.juro.localworkspace.LocalWorkspaceSettings;
import com.orahub.juro.review.model.ReviewTrack;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ReviewScheduleCalculatorTest {

    private final ReviewScheduleCalculator calculator = new ReviewScheduleCalculator();

    @Test
    void trackFrequencySettingsTuneCodeAndExplanationIndependently() {
        LocalWorkspaceSettings settings = settings(
                "LIGHT",
                "MORE_OFTEN",
                "MORE_OFTEN",
                "EXPLANATION_HEAVY",
                1,
                180,
                90
        );

        int codingInterval = calculator.passedIntervalDays(ReviewTrack.CODING, 3, 10, 2.5d, 4, settings);
        int explanationInterval = calculator.passedIntervalDays(ReviewTrack.EXPLANATION, 3, 10, 2.5d, 4, settings);

        assertThat(codingInterval).isEqualTo(19);
        assertThat(explanationInterval).isEqualTo(12);
    }

    @Test
    void configuredMinimumAndMaximumIntervalsClampResults() {
        LocalWorkspaceSettings settings = settings(
                "BALANCED",
                "BALANCED",
                "BALANCED",
                "BALANCED",
                3,
                7,
                5
        );

        int cappedCodingInterval = calculator.passedIntervalDays(ReviewTrack.CODING, 3, 10, 2.5d, 4, settings);
        int raisedExplanationFailure = calculator.failedIntervalDays(ReviewTrack.EXPLANATION, settings);

        assertThat(cappedCodingInterval).isEqualTo(7);
        assertThat(raisedExplanationFailure).isEqualTo(3);
    }

    private LocalWorkspaceSettings settings(
            String reviewIntensity,
            String codeReviewFrequency,
            String explanationReviewFrequency,
            String practiceFocus,
            int minimumIntervalDays,
            int maximumCodingIntervalDays,
            int maximumExplanationIntervalDays
    ) {
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();
        return new LocalWorkspaceSettings(
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
                reviewIntensity,
                codeReviewFrequency,
                explanationReviewFrequency,
                practiceFocus,
                minimumIntervalDays,
                maximumCodingIntervalDays,
                maximumExplanationIntervalDays,
                defaults.problemBankSyncEnabled(),
                defaults.problemBankSyncFilePath()
        );
    }
}
