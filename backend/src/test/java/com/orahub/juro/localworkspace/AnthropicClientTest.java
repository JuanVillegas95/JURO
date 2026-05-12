package com.orahub.juro.localworkspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

class AnthropicClientTest {

    private final AnthropicClient client = new AnthropicClient(new ObjectMapper());

    @Test
    void buildsMessagesPayload() throws IOException {
        String payload = client.messagesPayload(
                "claude-sonnet-4-20250514",
                "Return JSON."
        );

        assertThat(payload).isEqualTo("{\"model\":\"claude-sonnet-4-20250514\",\"max_tokens\":1200,\"messages\":[{\"role\":\"user\",\"content\":\"Return JSON.\"}]}");
    }

    @Test
    void extractsTextFromMessagesResponse() throws IOException {
        String generated = client.extractGeneratedText("""
                {
                  "content": [
                    {
                      "type": "text",
                      "text": "{\\"score\\":80,\\"status\\":\\"PASSED\\"}"
                    }
                  ]
                }
                """);

        assertThat(generated).isEqualTo("{\"score\":80,\"status\":\"PASSED\"}");
    }
}
