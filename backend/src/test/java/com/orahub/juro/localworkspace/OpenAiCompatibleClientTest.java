package com.orahub.juro.localworkspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

class OpenAiCompatibleClientTest {

    private final OpenAiCompatibleClient client = new OpenAiCompatibleClient(new ObjectMapper());

    @Test
    void buildsCurlEquivalentChatCompletionPayload() throws IOException {
        String payload = client.chatCompletionPayload(
                "gpt-5.4",
                "Reply with the single word pong. Do not include any other text."
        );

        assertThat(payload).isEqualTo("{\"model\":\"gpt-5.4\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the single word pong. Do not include any other text.\"}]}");
    }

    @Test
    void extractsTextFromResponsesApiShape() throws IOException {
        String generated = client.extractGeneratedText("""
                {
                  "output": [
                    {
                      "type": "message",
                      "content": [
                        {
                          "type": "output_text",
                          "text": "{\\"score\\":90,\\"status\\":\\"PASSED\\"}"
                        }
                      ]
                    }
                  ]
                }
                """);

        assertThat(generated).isEqualTo("{\"score\":90,\"status\":\"PASSED\"}");
    }

    @Test
    void extractsTextFromChatCompletionsShape() throws IOException {
        String generated = client.extractGeneratedText("""
                {
                  "choices": [
                    {
                      "message": {
                        "role": "assistant",
                        "content": "{\\"score\\":40,\\"status\\":\\"NEEDS_REVIEW\\"}"
                      }
                    }
                  ]
                }
                """);

        assertThat(generated).isEqualTo("{\"score\":40,\"status\":\"NEEDS_REVIEW\"}");
    }
}
