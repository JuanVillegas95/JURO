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
public class OpenAiCompatibleClient implements AiProviderClient {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(60);
    private static final int MAX_TRANSIENT_ATTEMPTS = 4;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public OpenAiCompatibleClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    @Override
    public String provider() {
        return "CODEX_ADAPTER";
    }

    @Override
    public LocalAiStatus status(LocalWorkspaceSettings settings) {
        try {
            String generated = generateWithChatCompletions(
                    "Reply with the single word pong. Do not include any other text.",
                    settings
            );
            if (generated.isBlank()) {
                throw new IOException("Codex Adapter returned an empty ping response.");
            }

            return new LocalAiStatus(
                    true,
                    provider(),
                    settings.aiBaseUrl(),
                    settings.aiModel(),
                    List.of(),
                    "Connected to Codex Adapter. Chat completions ping passed."
            );
        } catch (Exception exception) {
            return new LocalAiStatus(
                    false,
                    provider(),
                    settings.aiBaseUrl(),
                    settings.aiModel(),
                    List.of(),
                    exception.getMessage() == null ? "Unable to connect to Codex Adapter." : exception.getMessage()
            );
        }
    }

    @Override
    public String generateJson(String prompt, LocalWorkspaceSettings settings) throws IOException, InterruptedException {
        return generateWithChatCompletions(prompt, settings);
    }

    private String generateWithChatCompletions(String prompt, LocalWorkspaceSettings settings) throws IOException, InterruptedException {
        String body = chatCompletionPayload(settings.aiModel(), prompt);
        String responseBody = postJson(openAiUri(settings.aiBaseUrl(), "/chat/completions"), body, "Codex Adapter chat completions");
        String generated = extractGeneratedText(responseBody);
        if (generated.isBlank()) {
            throw new IOException("Codex Adapter returned an empty chat response.");
        }
        return generated;
    }

    String chatCompletionPayload(String model, String prompt) throws IOException {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("model", model);

        Map<String, String> message = new LinkedHashMap<>();
        message.put("role", "user");
        message.put("content", prompt);
        root.put("messages", List.of(message));

        return objectMapper.writeValueAsString(root);
    }

    private String postJson(URI uri, String body, String serviceName) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .version(HttpClient.Version.HTTP_1_1)
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        ProviderHttpException lastException = null;
        for (int attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt++) {
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

    String extractGeneratedText(String responseBody) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);

        JsonNode outputText = root.get("output_text");
        if (outputText != null && !outputText.asText().isBlank()) {
            return outputText.asText();
        }

        JsonNode output = root.get("output");
        if (output != null && output.isArray()) {
            StringBuilder builder = new StringBuilder();
            output.forEach(item -> appendContentText(builder, item.get("content")));
            if (!builder.isEmpty()) {
                return builder.toString().trim();
            }
        }

        JsonNode choices = root.get("choices");
        if (choices != null && choices.isArray() && !choices.isEmpty()) {
            JsonNode message = choices.get(0).get("message");
            if (message != null) {
                JsonNode content = message.get("content");
                if (content != null && content.isTextual()) {
                    return content.asText();
                }
                StringBuilder builder = new StringBuilder();
                appendContentText(builder, content);
                if (!builder.isEmpty()) {
                    return builder.toString().trim();
                }
            }
        }

        return "";
    }

    private void appendContentText(StringBuilder builder, JsonNode content) {
        if (content == null || !content.isArray()) {
            return;
        }

        content.forEach(node -> {
            JsonNode text = node.get("text");
            if (text != null && !text.asText().isBlank()) {
                if (!builder.isEmpty()) {
                    builder.append('\n');
                }
                builder.append(text.asText());
            }
        });
    }

    private URI openAiUri(String baseUrl, String path) {
        String normalizedBase = baseUrl == null || baseUrl.isBlank() ? "http://127.0.0.1:11435/v1/" : baseUrl.trim();
        while (normalizedBase.endsWith("/")) {
            normalizedBase = normalizedBase.substring(0, normalizedBase.length() - 1);
        }
        if (!normalizedBase.endsWith("/v1")) {
            normalizedBase += "/v1";
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
