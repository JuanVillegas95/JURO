package com.orahub.juro.localworkspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalSettingsServiceTest {

    @Test
    void savesSchedulingSettingsWithValidIntervals() throws IOException {
        LocalSettingsService service = new LocalSettingsService(new ObjectMapper(), settingsPath().toString());

        LocalWorkspaceSettings saved = service.saveSettings(validRequest(
                "LIGHT",
                "LESS_OFTEN",
                "MORE_OFTEN",
                "EXPLANATION_HEAVY",
                2,
                120,
                45
        ));

        assertThat(saved.reviewIntensity()).isEqualTo("LIGHT");
        assertThat(saved.codeReviewFrequency()).isEqualTo("LESS_OFTEN");
        assertThat(saved.explanationReviewFrequency()).isEqualTo("MORE_OFTEN");
        assertThat(saved.practiceFocus()).isEqualTo("EXPLANATION_HEAVY");
        assertThat(saved.minimumIntervalDays()).isEqualTo(2);
        assertThat(saved.maximumCodingIntervalDays()).isEqualTo(120);
        assertThat(saved.maximumExplanationIntervalDays()).isEqualTo(45);
    }

    @Test
    void rejectsSchedulingSettingsWhenMaximumIsBelowMinimum() throws IOException {
        LocalSettingsService service = new LocalSettingsService(new ObjectMapper(), settingsPath().toString());

        assertThatThrownBy(() -> service.saveSettings(validRequest(
                "BALANCED",
                "BALANCED",
                "BALANCED",
                "BALANCED",
                10,
                9,
                90
        ))).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("maximumCodingIntervalDays");
    }

    @Test
    void defaultsSchedulingSettingsWhenFieldsAreOmitted() throws IOException {
        LocalSettingsService service = new LocalSettingsService(new ObjectMapper(), settingsPath().toString());
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();

        LocalWorkspaceSettings saved = service.saveSettings(new SaveLocalWorkspaceSettingsRequest(
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
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        ));

        assertThat(saved.reviewIntensity()).isEqualTo(defaults.reviewIntensity());
        assertThat(saved.codeReviewFrequency()).isEqualTo(defaults.codeReviewFrequency());
        assertThat(saved.explanationReviewFrequency()).isEqualTo(defaults.explanationReviewFrequency());
        assertThat(saved.practiceFocus()).isEqualTo(defaults.practiceFocus());
        assertThat(saved.minimumIntervalDays()).isEqualTo(defaults.minimumIntervalDays());
        assertThat(saved.maximumCodingIntervalDays()).isEqualTo(defaults.maximumCodingIntervalDays());
        assertThat(saved.maximumExplanationIntervalDays()).isEqualTo(defaults.maximumExplanationIntervalDays());
    }

    @Test
    void savesCodexAdapterAiProviderSettings() throws IOException {
        LocalSettingsService service = new LocalSettingsService(new ObjectMapper(), settingsPath().toString());
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();

        LocalWorkspaceSettings saved = service.saveSettings(new SaveLocalWorkspaceSettingsRequest(
                defaults.workspaceDirectory(),
                defaults.editor(),
                defaults.customEditorCommand(),
                "CODEX_ADAPTER",
                "http://127.0.0.1:11435/v1/",
                "gpt-5.4",
                "",
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
                defaults.problemBankSyncEnabled(),
                defaults.problemBankSyncFilePath()
        ));

        assertThat(saved.aiProvider()).isEqualTo("CODEX_ADAPTER");
        assertThat(saved.aiBaseUrl()).isEqualTo("http://127.0.0.1:11435/v1/");
        assertThat(saved.aiModel()).isEqualTo("gpt-5.4");
        assertThat(saved.ollamaBaseUrl()).isEqualTo(defaults.ollamaBaseUrl());
        assertThat(saved.ollamaModel()).isEqualTo(defaults.ollamaModel());
    }

    @Test
    void savesAnthropicAiProviderSettings() throws IOException {
        LocalSettingsService service = new LocalSettingsService(new ObjectMapper(), settingsPath().toString());
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();

        LocalWorkspaceSettings saved = service.saveSettings(new SaveLocalWorkspaceSettingsRequest(
                defaults.workspaceDirectory(),
                defaults.editor(),
                defaults.customEditorCommand(),
                "ANTHROPIC",
                "https://api.anthropic.com",
                "claude-sonnet-4-20250514",
                "sk-ant-test",
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
                defaults.problemBankSyncEnabled(),
                defaults.problemBankSyncFilePath()
        ));

        assertThat(saved.aiProvider()).isEqualTo("ANTHROPIC");
        assertThat(saved.aiBaseUrl()).isEqualTo("https://api.anthropic.com");
        assertThat(saved.aiModel()).isEqualTo("claude-sonnet-4-20250514");
        assertThat(saved.aiApiKey()).isEqualTo("sk-ant-test");
    }

    @Test
    void savesNeovimEditorSettings() throws IOException {
        LocalSettingsService service = new LocalSettingsService(new ObjectMapper(), settingsPath().toString());
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();

        LocalWorkspaceSettings saved = service.saveSettings(new SaveLocalWorkspaceSettingsRequest(
                defaults.workspaceDirectory(),
                "NVIM",
                "",
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
                defaults.problemBankSyncEnabled(),
                defaults.problemBankSyncFilePath()
        ));

        assertThat(saved.editor()).isEqualTo("NVIM");
    }

    @Test
    void rejectsUnsupportedEditorSettings() throws IOException {
        LocalSettingsService service = new LocalSettingsService(new ObjectMapper(), settingsPath().toString());
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();

        assertThatThrownBy(() -> service.saveSettings(new SaveLocalWorkspaceSettingsRequest(
                defaults.workspaceDirectory(),
                "CURSOR",
                "",
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
                defaults.problemBankSyncEnabled(),
                defaults.problemBankSyncFilePath()
        ))).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("VS_CODE or NVIM");
    }

    @Test
    void rejectsRemovedWhisperTranscriptionProvider() throws IOException {
        LocalSettingsService service = new LocalSettingsService(new ObjectMapper(), settingsPath().toString());
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();

        assertThatThrownBy(() -> service.saveSettings(new SaveLocalWorkspaceSettingsRequest(
                defaults.workspaceDirectory(),
                defaults.editor(),
                defaults.customEditorCommand(),
                defaults.aiProvider(),
                defaults.aiBaseUrl(),
                defaults.aiModel(),
                defaults.aiApiKey(),
                defaults.ollamaBaseUrl(),
                defaults.ollamaModel(),
                "WHISPER",
                defaults.schedulerAlgorithm(),
                defaults.reviewIntensity(),
                defaults.codeReviewFrequency(),
                defaults.explanationReviewFrequency(),
                defaults.practiceFocus(),
                defaults.minimumIntervalDays(),
                defaults.maximumCodingIntervalDays(),
                defaults.maximumExplanationIntervalDays(),
                defaults.problemBankSyncEnabled(),
                defaults.problemBankSyncFilePath()
        ))).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("BROWSER or MANUAL");
    }

    @Test
    void readsLegacyOllamaSettingsAsDefaultAiProvider() throws IOException {
        Path settingsPath = settingsPath();
        Files.writeString(settingsPath, """
                {
                  "workspaceDirectory": "/tmp/juro-workspace",
                  "editor": "VS_CODE",
                  "customEditorCommand": "",
                  "ollamaBaseUrl": "http://localhost:11434",
                  "ollamaModel": "qwen2.5",
                  "transcriptionProvider": "BROWSER"
                }
                """);
        LocalSettingsService service = new LocalSettingsService(new ObjectMapper(), settingsPath.toString());

        LocalWorkspaceSettings loaded = service.getSettings();

        assertThat(loaded.aiProvider()).isEqualTo("OLLAMA");
        assertThat(loaded.aiBaseUrl()).isEqualTo("http://localhost:11434");
        assertThat(loaded.aiModel()).isEqualTo("qwen2.5");
    }

    private SaveLocalWorkspaceSettingsRequest validRequest(
            String reviewIntensity,
            String codeReviewFrequency,
            String explanationReviewFrequency,
            String practiceFocus,
            int minimumIntervalDays,
            int maximumCodingIntervalDays,
            int maximumExplanationIntervalDays
    ) {
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();
        return new SaveLocalWorkspaceSettingsRequest(
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

    private Path settingsPath() throws IOException {
        Path directory = Path.of("target", "tmp", "local-settings-service-test", UUID.randomUUID().toString());
        Files.createDirectories(directory);
        return directory.resolve("settings.json");
    }
}
