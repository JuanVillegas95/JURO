package com.orahub.juro.localworkspace;

public record SaveLocalWorkspaceSettingsRequest(
        String workspaceDirectory,
        String editor,
        String customEditorCommand,
        String aiProvider,
        String aiBaseUrl,
        String aiModel,
        String aiApiKey,
        String ollamaBaseUrl,
        String ollamaModel,
        String transcriptionProvider,
        String schedulerAlgorithm,
        String reviewIntensity,
        String codeReviewFrequency,
        String explanationReviewFrequency,
        String practiceFocus,
        Integer minimumIntervalDays,
        Integer maximumCodingIntervalDays,
        Integer maximumExplanationIntervalDays,
        Boolean problemBankSyncEnabled,
        String problemBankSyncFilePath
) {
}
