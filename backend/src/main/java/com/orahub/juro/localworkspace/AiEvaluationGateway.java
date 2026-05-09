package com.orahub.juro.localworkspace;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;

@Component
public class AiEvaluationGateway {

    private final LocalSettingsService settingsService;
    private final List<AiProviderClient> clients;

    public AiEvaluationGateway(LocalSettingsService settingsService, List<AiProviderClient> clients) {
        this.settingsService = settingsService;
        this.clients = clients;
    }

    public LocalAiStatus status() {
        LocalWorkspaceSettings settings = settingsService.getSettings();
        return clientFor(settings).status(settings);
    }

    public String generateJson(String prompt) throws IOException, InterruptedException {
        LocalWorkspaceSettings settings = settingsService.getSettings();
        return clientFor(settings).generateJson(prompt, settings);
    }

    public String modelLabel() {
        LocalWorkspaceSettings settings = settingsService.getSettings();
        return "%s · %s".formatted(providerLabel(settings.aiProvider()), settings.aiModel());
    }

    private AiProviderClient clientFor(LocalWorkspaceSettings settings) {
        return clients.stream()
                .filter(client -> client.provider().equals(settings.aiProvider()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No AI provider is configured for %s.".formatted(settings.aiProvider())));
    }

    private String providerLabel(String provider) {
        if ("CODEX_ADAPTER".equals(provider)) {
            return "Codex Adapter";
        }

        return "Ollama";
    }
}
