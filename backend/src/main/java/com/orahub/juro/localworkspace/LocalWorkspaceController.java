package com.orahub.juro.localworkspace;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/local")
public class LocalWorkspaceController {

    private final LocalSettingsService settingsService;
    private final LocalWorkspaceService workspaceService;
    private final AiEvaluationGateway aiEvaluationGateway;

    public LocalWorkspaceController(
            LocalSettingsService settingsService,
            LocalWorkspaceService workspaceService,
            AiEvaluationGateway aiEvaluationGateway
    ) {
        this.settingsService = settingsService;
        this.workspaceService = workspaceService;
        this.aiEvaluationGateway = aiEvaluationGateway;
    }

    @GetMapping("/settings")
    public LocalWorkspaceSettings getSettings() {
        return settingsService.getSettings();
    }

    @PutMapping("/settings")
    public LocalWorkspaceSettings saveSettings(@RequestBody SaveLocalWorkspaceSettingsRequest request) {
        return settingsService.saveSettings(request);
    }

    @GetMapping("/tooling/status")
    public LocalToolingStatus toolingStatus() {
        return workspaceService.toolingStatus();
    }

    @GetMapping("/ai/status")
    public LocalAiStatus aiStatus() {
        return aiEvaluationGateway.status();
    }

    @GetMapping("/ollama/status")
    public LocalAiStatus ollamaStatus() {
        return aiEvaluationGateway.status();
    }

    @GetMapping("/workspace/active")
    public LocalProblemWorkspaceResponse activeWorkspace() {
        return workspaceService.activeWorkspace();
    }

    @PostMapping("/workspace/active/clear")
    public LocalProblemWorkspaceResponse clearActiveWorkspace() {
        return workspaceService.clearActiveWorkspace();
    }

    @PostMapping("/problems/{problemId}/scaffold")
    public LocalProblemWorkspaceResponse createScaffold(@PathVariable UUID problemId) {
        return workspaceService.createScaffold(problemId);
    }

    @PostMapping("/problems/{problemId}/open-editor")
    public LocalProblemWorkspaceResponse openInEditor(@PathVariable UUID problemId) {
        return workspaceService.openInEditor(problemId);
    }

    @PostMapping("/problems/{problemId}/run-tests")
    public LocalProblemRunResponse runTests(@PathVariable UUID problemId) {
        return workspaceService.runTests(problemId);
    }
}
