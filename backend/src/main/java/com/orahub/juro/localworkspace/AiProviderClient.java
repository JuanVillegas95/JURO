package com.orahub.juro.localworkspace;

import java.io.IOException;

public interface AiProviderClient {

    String provider();

    LocalAiStatus status(LocalWorkspaceSettings settings);

    String generateJson(String prompt, LocalWorkspaceSettings settings) throws IOException, InterruptedException;
}
