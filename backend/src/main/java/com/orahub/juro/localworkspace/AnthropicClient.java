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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class AnthropicClient implements AiProviderClient {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(60);
    private static final String ANTHROPIC_VERSION = "2023-06-01";
    private static final int MAX_TRANSIENT_ATTEMPTS = 4;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public AnthropicClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    @Override
    public String provider() {
        return "ANTHROPIC";
    }

    @Override
    public LocalAiStatus status(LocalWorkspaceSettings settings) {
        if (settings.aiApiKey() == null || settings.aiApiKey().isBlank()) {
            return new LocalAiStatus(
                    false,
                    provider(),
                    settings.aiBaseUrl(),
                    settings.aiModel(),
                    List.of(),
                    "Anthropic API key is required."
            );
        }

        try {
            HttpRequest request = requestBuilder(settings, anthropicUri(settings.aiBaseUrl(), "/v1/models/" + settings.aiModel()))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IOException("Anthropic returned HTTP %d%s.".formatted(response.statusCode(), responseDetail(response.body())));
            }

            return new LocalAiStatus(
                    true,
                    provider(),
                    settings.aiBaseUrl(),
                    settings.aiModel(),
                    List.of(settings.aiModel()),
                    "Connected to Anthropic. Model lookup passed."
            );
        } catch (Exception exception) {
            return new LocalAiStatus(
                    false,
                    provider(),
                    settings.aiBaseUrl(),
                    settings.aiModel(),
                    List.of(),
                    exception.getMessage() == null ? "Unable to connect to Anthropic." : exception.getMessage()
            );
        }
    }

    @Override
    public String generateJson(String prompt, LocalWorkspaceSettings settings) throws IOException, InterruptedException {
        if (settings.aiApiKey() == null || settings.aiApiKey().isBlank()) {
            throw new IOException("Anthropic API key is required.");
        }

        String responseBody = postJson(
                settings,
                anthropicUri(settings.aiBaseUrl(), "/v1/messages"),
                messagesPayload(settings.aiModel(), prompt),
                "Anthropic messages"
        );
        String generated = extractGeneratedText(responseBody);
        if (generated.isBlank()) {
            throw new IOException("Anthropic returned an empty message response.");
        }
        return generated;
    }

    String messagesPayload(String model, String prompt) throws IOException {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("model", model);
        root.put("max_tokens", 1200);

        Map<String, String> message = new LinkedHashMap<>();
        message.put("role", "user");
        message.put("content", prompt);
        root.put("messages", List.of(message));

        return objectMapper.writeValueAsString(root);
    }

    String extractGeneratedText(String responseBody) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode content = root.get("content");
        if (content == null || !content.isArray()) {
            return "";
        }

        StringBuilder builder = new StringBuilder();
        content.forEach(item -> {
            JsonNode text = item.get("text");
            if (text != null && !text.asText().isBlank()) {
                if (!builder.isEmpty()) {
                    builder.append('\n');
                }
                builder.append(text.asText());
            }
        });
        return builder.toString().trim();
    }

    private String postJson(LocalWorkspaceSettings settings, URI uri, String body, String serviceName) throws IOException, InterruptedException {
        ProviderHttpException lastException = null;
        for (int attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt++) {
            HttpRequest request = requestBuilder(settings, uri)
                    .timeout(REQUEST_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return response.body();
            }

            lastException = new ProviderHttpException(
                    "%s returned HTTP %d%s.".formatted(serviceName, response.statusCode(), responseDetail(response.body())),
                    response.statusCode()
            );
            if (!shouldRetryTransient(response.statusCode()) || attempt == MAX_TRANSIENT_ATTEMPTS) {
                throw lastException;
            }
            Thread.sleep(350L * attempt);
        }

        throw lastException == null
                ? new IOException("%s did not return a response.".formatted(serviceName))
                : lastException;
    }

    private HttpRequest.Builder requestBuilder(LocalWorkspaceSettings settings, URI uri) {
        return HttpRequest.newBuilder(uri)
                .version(HttpClient.Version.HTTP_1_1)
                .header("x-api-key", settings.aiApiKey())
                .header("anthropic-version", ANTHROPIC_VERSION);
    }

    private boolean shouldRetryTransient(int statusCode) {
        return statusCode == 500
                || statusCode == 502
                || statusCode == 503
                || statusCode == 504;
    }

    private String responseDetail(String body) {
        if (body == null || body.isBlank()) {
            return "";
        }
        String normalized = body.replaceAll("\\s+", " ").trim();
        if (normalized.length() > 180) {
            normalized = normalized.substring(0, 180) + "...";
        }
        return ": " + normalized;
    }

    private URI anthropicUri(String baseUrl, String path) {
        String normalizedBase = baseUrl == null || baseUrl.isBlank() ? "https://api.anthropic.com" : baseUrl.trim();
        while (normalizedBase.endsWith("/")) {
            normalizedBase = normalizedBase.substring(0, normalizedBase.length() - 1);
        }
        return URI.create(normalizedBase + path);
    }

    private static class ProviderHttpException extends IOException {

        private final int statusCode;

        ProviderHttpException(String message, int statusCode) {
            super(message);
            this.statusCode = statusCode;
        }

        int statusCode() {
            return statusCode;
        }
    }
}
