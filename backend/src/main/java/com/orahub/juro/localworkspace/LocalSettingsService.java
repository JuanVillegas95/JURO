package com.orahub.juro.localworkspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

@Service
public class LocalSettingsService {

    private final ObjectMapper objectMapper;
    private final Path settingsPath;

    public LocalSettingsService(
            ObjectMapper objectMapper,
            @Value("${app.local.settings-path:}") String settingsPathOverride
    ) {
        this.objectMapper = objectMapper;
        this.settingsPath = settingsPathOverride == null || settingsPathOverride.isBlank()
                ? Path.of(System.getProperty("user.home"), ".juro", "settings.json")
                : Path.of(settingsPathOverride).toAbsolutePath().normalize();
    }

    public LocalWorkspaceSettings getSettings() {
        if (!Files.isRegularFile(settingsPath)) {
            return LocalWorkspaceSettings.defaults();
        }

        try {
            return normalize(objectMapper.readValue(settingsPath.toFile(), LocalWorkspaceSettings.class), false);
        } catch (IOException exception) {
            return LocalWorkspaceSettings.defaults();
        }
    }

    public LocalWorkspaceSettings saveSettings(SaveLocalWorkspaceSettingsRequest request) {
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();
        LocalWorkspaceSettings settings = normalize(new LocalWorkspaceSettings(
                request.workspaceDirectory(),
                request.editor(),
                request.customEditorCommand(),
                request.aiProvider(),
                request.aiBaseUrl(),
                request.aiModel(),
                request.aiApiKey(),
                request.ollamaBaseUrl(),
                request.ollamaModel(),
                request.transcriptionProvider(),
                request.schedulerAlgorithm(),
                request.reviewIntensity(),
                request.codeReviewFrequency(),
                request.explanationReviewFrequency(),
                request.practiceFocus(),
                request.minimumIntervalDays() == null ? defaults.minimumIntervalDays() : request.minimumIntervalDays(),
                request.maximumCodingIntervalDays() == null ? defaults.maximumCodingIntervalDays() : request.maximumCodingIntervalDays(),
                request.maximumExplanationIntervalDays() == null ? defaults.maximumExplanationIntervalDays() : request.maximumExplanationIntervalDays(),
                request.problemBankSyncEnabled() != null && request.problemBankSyncEnabled(),
                request.problemBankSyncFilePath()
        ), true);

        try {
            Files.createDirectories(settingsPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(settingsPath.toFile(), settings);
            return settings;
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to save JURO local settings.", exception);
        }
    }

    private LocalWorkspaceSettings normalize(LocalWorkspaceSettings settings, boolean strictSchedulingValidation) {
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();
        String workspaceDirectory = textOrDefault(settings.workspaceDirectory(), defaults.workspaceDirectory());
        String editor = textOrDefault(settings.editor(), defaults.editor()).toUpperCase(Locale.ROOT);
        String customEditorCommand = textOrDefault(settings.customEditorCommand(), "");
        String aiProvider = textOrDefault(settings.aiProvider(), defaults.aiProvider()).toUpperCase(Locale.ROOT);
        if (!aiProvider.equals("OLLAMA") && !aiProvider.equals("CODEX_ADAPTER") && !aiProvider.equals("ANTHROPIC")) {
            if (strictSchedulingValidation) {
                throw new IllegalArgumentException("aiProvider must be OLLAMA, CODEX_ADAPTER, or ANTHROPIC.");
            }
            aiProvider = defaults.aiProvider();
        }
        String legacyOllamaBaseUrl = textOrDefault(settings.ollamaBaseUrl(), "");
        String legacyOllamaModel = textOrDefault(settings.ollamaModel(), "");
        String aiBaseUrl = textOrDefault(
                settings.aiBaseUrl(),
                aiProvider.equals("OLLAMA") && !legacyOllamaBaseUrl.isBlank()
                        ? legacyOllamaBaseUrl
                        : defaultAiBaseUrl(aiProvider)
        );
        String aiModel = textOrDefault(
                settings.aiModel(),
                aiProvider.equals("OLLAMA") && !legacyOllamaModel.isBlank()
                        ? legacyOllamaModel
                        : defaultAiModel(aiProvider)
        );
        String aiApiKey = "ANTHROPIC".equals(aiProvider)
                ? textOrDefault(settings.aiApiKey(), LocalWorkspaceSettings.defaultAnthropicApiKey())
                : textOrDefault(settings.aiApiKey(), "");
        String ollamaBaseUrl = aiProvider.equals("OLLAMA")
                ? aiBaseUrl
                : textOrDefault(settings.ollamaBaseUrl(), defaults.ollamaBaseUrl());
        String ollamaModel = aiProvider.equals("OLLAMA")
                ? aiModel
                : textOrDefault(settings.ollamaModel(), defaults.ollamaModel());
        String transcriptionProvider = textOrDefault(settings.transcriptionProvider(), defaults.transcriptionProvider())
                .toUpperCase(Locale.ROOT);
        String schedulerAlgorithm = textOrDefault(settings.schedulerAlgorithm(), defaults.schedulerAlgorithm())
                .toUpperCase(Locale.ROOT);
        String reviewIntensity = textOrDefault(settings.reviewIntensity(), defaults.reviewIntensity())
                .toUpperCase(Locale.ROOT);
        String codeReviewFrequency = textOrDefault(settings.codeReviewFrequency(), defaults.codeReviewFrequency())
                .toUpperCase(Locale.ROOT);
        String explanationReviewFrequency = textOrDefault(settings.explanationReviewFrequency(), defaults.explanationReviewFrequency())
                .toUpperCase(Locale.ROOT);
        String practiceFocus = textOrDefault(settings.practiceFocus(), defaults.practiceFocus())
                .toUpperCase(Locale.ROOT);
        int minimumIntervalDays = positiveOrDefault(settings.minimumIntervalDays(), defaults.minimumIntervalDays());
        int maximumCodingIntervalDays = positiveOrDefault(settings.maximumCodingIntervalDays(), defaults.maximumCodingIntervalDays());
        int maximumExplanationIntervalDays = positiveOrDefault(settings.maximumExplanationIntervalDays(), defaults.maximumExplanationIntervalDays());
        boolean problemBankSyncEnabled = settings.problemBankSyncEnabled();
        String problemBankSyncFilePath = textOrDefault(settings.problemBankSyncFilePath(), defaults.problemBankSyncFilePath());

        if (!editor.equals("VS_CODE") && !editor.equals("NVIM")) {
            if (strictSchedulingValidation) {
                throw new IllegalArgumentException("editor must be VS_CODE or NVIM.");
            }
            editor = defaults.editor();
        }
        customEditorCommand = "";

        if (!transcriptionProvider.equals("BROWSER")
                && !transcriptionProvider.equals("MANUAL")) {
            if (strictSchedulingValidation) {
                throw new IllegalArgumentException("transcriptionProvider must be BROWSER or MANUAL.");
            }
            transcriptionProvider = defaults.transcriptionProvider();
        }

        if (!schedulerAlgorithm.equals("SM2")) {
            if (strictSchedulingValidation) {
                throw new IllegalArgumentException("schedulerAlgorithm must be SM2.");
            }
            schedulerAlgorithm = defaults.schedulerAlgorithm();
        }

        reviewIntensity = normalizeSchedulingChoice(
                "reviewIntensity",
                reviewIntensity,
                defaults.reviewIntensity(),
                strictSchedulingValidation,
                "LIGHT",
                "BALANCED",
                "AGGRESSIVE"
        );
        codeReviewFrequency = normalizeSchedulingChoice(
                "codeReviewFrequency",
                codeReviewFrequency,
                defaults.codeReviewFrequency(),
                strictSchedulingValidation,
                "LESS_OFTEN",
                "BALANCED",
                "MORE_OFTEN"
        );
        explanationReviewFrequency = normalizeSchedulingChoice(
                "explanationReviewFrequency",
                explanationReviewFrequency,
                defaults.explanationReviewFrequency(),
                strictSchedulingValidation,
                "LESS_OFTEN",
                "BALANCED",
                "MORE_OFTEN"
        );
        practiceFocus = normalizeSchedulingChoice(
                "practiceFocus",
                practiceFocus,
                defaults.practiceFocus(),
                strictSchedulingValidation,
                "CODE_HEAVY",
                "BALANCED",
                "EXPLANATION_HEAVY"
        );

        if (settings.minimumIntervalDays() < 1 && strictSchedulingValidation) {
            throw new IllegalArgumentException("minimumIntervalDays must be at least 1.");
        }

        if (maximumCodingIntervalDays < minimumIntervalDays) {
            if (strictSchedulingValidation) {
                throw new IllegalArgumentException("maximumCodingIntervalDays must be greater than or equal to minimumIntervalDays.");
            }
            maximumCodingIntervalDays = defaults.maximumCodingIntervalDays();
        }

        if (maximumExplanationIntervalDays < minimumIntervalDays) {
            if (strictSchedulingValidation) {
                throw new IllegalArgumentException("maximumExplanationIntervalDays must be greater than or equal to minimumIntervalDays.");
            }
            maximumExplanationIntervalDays = defaults.maximumExplanationIntervalDays();
        }

        if (problemBankSyncEnabled && problemBankSyncFilePath.isBlank() && strictSchedulingValidation) {
            throw new IllegalArgumentException("problemBankSyncFilePath is required when problem bank JSON sync is enabled.");
        }

        return new LocalWorkspaceSettings(
                workspaceDirectory,
                editor,
                customEditorCommand,
                aiProvider,
                aiBaseUrl,
                aiModel,
                aiApiKey,
                ollamaBaseUrl,
                ollamaModel,
                transcriptionProvider,
                schedulerAlgorithm,
                reviewIntensity,
                codeReviewFrequency,
                explanationReviewFrequency,
                practiceFocus,
                minimumIntervalDays,
                maximumCodingIntervalDays,
                maximumExplanationIntervalDays,
                problemBankSyncEnabled,
                problemBankSyncFilePath
        );
    }

    private String defaultAiBaseUrl(String provider) {
        if ("CODEX_ADAPTER".equals(provider)) {
            return LocalWorkspaceSettings.defaultCodexAdapterBaseUrl();
        }
        if ("ANTHROPIC".equals(provider)) {
            return LocalWorkspaceSettings.defaultAnthropicBaseUrl();
        }

        return LocalWorkspaceSettings.defaultOllamaBaseUrl();
    }

    private String defaultAiModel(String provider) {
        if ("CODEX_ADAPTER".equals(provider)) {
            return LocalWorkspaceSettings.defaultCodexAdapterModel();
        }
        if ("ANTHROPIC".equals(provider)) {
            return LocalWorkspaceSettings.defaultAnthropicModel();
        }

        return LocalWorkspaceSettings.defaultOllamaModel();
    }

    private String normalizeSchedulingChoice(
            String fieldName,
            String value,
            String fallback,
            boolean strict,
            String... allowedValues
    ) {
        for (String allowedValue : allowedValues) {
            if (allowedValue.equals(value)) {
                return value;
            }
        }

        if (strict) {
            throw new IllegalArgumentException("%s must be one of: %s.".formatted(fieldName, String.join(", ", allowedValues)));
        }

        return fallback;
    }

    private String textOrDefault(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value.trim();
    }

    private int positiveOrDefault(int value, int fallback) {
        return value > 0 ? value : fallback;
    }
}
