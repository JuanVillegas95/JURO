package com.orahub.juro.localworkspace;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class OllamaClient implements AiProviderClient {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(45);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public OllamaClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    @Override
    public String provider() {
        return "OLLAMA";
    }

    @Override
    public LocalAiStatus status(LocalWorkspaceSettings settings) {
        try {
            List<String> models = models(settings);
            boolean selectedModelAvailable = models.isEmpty() || models.contains(settings.aiModel());
            String message = selectedModelAvailable
                    ? "Connected to Ollama."
                    : "Connected to Ollama, but the selected model was not found.";
            return new LocalAiStatus(true, provider(), settings.aiBaseUrl(), settings.aiModel(), models, message);
        } catch (Exception exception) {
            return new LocalAiStatus(
                    false,
                    provider(),
                    settings.aiBaseUrl(),
                    settings.aiModel(),
                    List.of(),
                    exception.getMessage() == null ? "Unable to connect to Ollama." : exception.getMessage()
            );
        }
    }

    @Override
    public String generateJson(String prompt, LocalWorkspaceSettings settings) throws IOException, InterruptedException {
        String body = objectMapper.writeValueAsString(Map.of(
                "model", settings.aiModel(),
                "prompt", prompt,
                "stream", false,
                "format", "json"
        ));
        HttpRequest request = HttpRequest.newBuilder(uri(settings.aiBaseUrl(), "/api/generate"))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("Ollama returned HTTP %d.".formatted(response.statusCode()));
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode generated = root.get("response");
        if (generated == null || generated.asText().isBlank()) {
            throw new IOException("Ollama returned an empty response.");
        }
        return generated.asText();
    }

    private List<String> models(LocalWorkspaceSettings settings) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(uri(settings.aiBaseUrl(), "/api/tags"))
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("Ollama returned HTTP %d.".formatted(response.statusCode()));
        }

        JsonNode root = objectMapper.readTree(response.body());
        List<String> names = new ArrayList<>();
        JsonNode models = root.get("models");
        if (models != null && models.isArray()) {
            models.forEach(model -> {
                JsonNode name = model.get("name");
                if (name != null && !name.asText().isBlank()) {
                    names.add(name.asText());
                }
            });
        }
        return names;
    }

    private URI uri(String baseUrl, String path) {
        String normalizedBase = baseUrl == null || baseUrl.isBlank() ? "http://localhost:11434" : baseUrl.trim();
        while (normalizedBase.endsWith("/")) {
            normalizedBase = normalizedBase.substring(0, normalizedBase.length() - 1);
        }
        return URI.create(normalizedBase + path);
    }
}
