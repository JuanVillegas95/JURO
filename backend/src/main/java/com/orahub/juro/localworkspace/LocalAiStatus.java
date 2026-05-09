package com.orahub.juro.localworkspace;

import java.util.List;

public record LocalAiStatus(
        boolean available,
        String provider,
        String baseUrl,
        String selectedModel,
        List<String> models,
        String message
) {
}
