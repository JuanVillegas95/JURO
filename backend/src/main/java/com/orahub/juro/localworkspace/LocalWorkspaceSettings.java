package com.orahub.juro.localworkspace;

public record LocalWorkspaceSettings(
        String workspaceDirectory,
        String editor,
        String customEditorCommand,
        String aiProvider,
        String aiBaseUrl,
        String aiModel,
        String ollamaBaseUrl,
        String ollamaModel,
        String transcriptionProvider,
        String schedulerAlgorithm,
        String reviewIntensity,
        String codeReviewFrequency,
        String explanationReviewFrequency,
        String practiceFocus,
        int minimumIntervalDays,
        int maximumCodingIntervalDays,
        int maximumExplanationIntervalDays
) {
    public static LocalWorkspaceSettings defaults() {
        return new LocalWorkspaceSettings(
                defaultWorkspaceDirectory(),
                "VS_CODE",
                "",
                "OLLAMA",
                defaultOllamaBaseUrl(),
                defaultOllamaModel(),
                defaultOllamaBaseUrl(),
                defaultOllamaModel(),
                "BROWSER",
                "SM2",
                "BALANCED",
                "BALANCED",
                "BALANCED",
                "BALANCED",
                1,
                180,
                90
        );
    }

    private static String defaultWorkspaceDirectory() {
        String configuredWorkspace = System.getenv("JURO_WORKSPACE_DIRECTORY");
        if (configuredWorkspace != null && !configuredWorkspace.isBlank()) {
            return configuredWorkspace.trim();
        }

        return System.getProperty("user.home") + "/juro-workspace";
    }

    static String defaultOllamaBaseUrl() {
        return envOrDefault("JURO_OLLAMA_BASE_URL", "http://localhost:11434");
    }

    static String defaultOllamaModel() {
        return envOrDefault("JURO_OLLAMA_MODEL", "llama3.1");
    }

    static String defaultCodexAdapterBaseUrl() {
        return envOrDefault("JURO_CODEX_ADAPTER_BASE_URL", "http://127.0.0.1:11435/v1/");
    }

    static String defaultCodexAdapterModel() {
        return envOrDefault("JURO_CODEX_ADAPTER_MODEL", "gpt-5.4");
    }

    private static String envOrDefault(String name, String fallback) {
        String configuredValue = System.getenv(name);
        if (configuredValue != null && !configuredValue.isBlank()) {
            return configuredValue.trim();
        }

        return fallback;
    }
}
