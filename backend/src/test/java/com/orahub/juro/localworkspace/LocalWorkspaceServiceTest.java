package com.orahub.juro.localworkspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.model.ProblemDifficulty;
import com.orahub.juro.problem.model.ProblemTestCase;
import com.orahub.juro.problem.model.ProblemType;
import com.orahub.juro.problem.service.ProblemService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LocalWorkspaceServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void rebuildingScaffoldUsesOneCurrentWorkspaceAndDoesNotPreservePreviousSolution() throws IOException {
        Path workspace = testWorkspace();
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        Problem first = problem(firstId, "two-sum", "Two Sum", "return new int[] {0, 1};");
        Problem second = problem(secondId, "contains-duplicate", "Contains Duplicate", "return new int[] {2, 3};");
        ProblemService problemService = mock(ProblemService.class);
        when(problemService.getProblemEntity(firstId)).thenReturn(first);
        when(problemService.getProblemEntity(secondId)).thenReturn(second);
        LocalWorkspaceService service = service(problemService, workspace);

        LocalProblemWorkspaceResponse firstWorkspace = service.createScaffold(firstId);
        Path currentPath = Path.of(firstWorkspace.scaffoldPath());
        Files.writeString(currentPath.resolve("src").resolve("Solution.java"), "class Solution { public int[] solve(int[] nums, int target) { return new int[] {-1, -1}; } }");

        LocalProblemWorkspaceResponse secondWorkspace = service.createScaffold(secondId);

        assertThat(secondWorkspace.scaffoldPath()).isEqualTo(firstWorkspace.scaffoldPath());
        assertThat(currentPath.getFileName().toString()).isEqualTo("juro-current");
        assertThat(Files.readString(currentPath.resolve(".juro-scaffold")).trim()).isEqualTo(secondId.toString());
        assertThat(Files.readString(currentPath.resolve("README.md"))).contains("Contains Duplicate").doesNotContain("Two Sum");
        assertThat(Files.readString(currentPath.resolve("src").resolve("Solution.java")))
                .contains("return new int[] {2, 3};")
                .doesNotContain("-1, -1");
    }

    @Test
    void refusesToDeleteUnmanagedCurrentWorkspace() throws IOException {
        Path workspace = testWorkspace();
        Path unmanagedCurrentWorkspace = workspace.resolve("juro-current");
        Files.createDirectories(unmanagedCurrentWorkspace);
        Files.writeString(unmanagedCurrentWorkspace.resolve("notes.txt"), "not created by JURO");
        UUID problemId = UUID.randomUUID();
        ProblemService problemService = mock(ProblemService.class);
        when(problemService.getProblemEntity(problemId)).thenReturn(problem(problemId, "two-sum", "Two Sum", "return new int[] {0, 1};"));
        LocalWorkspaceService service = service(problemService, workspace);

        assertThatThrownBy(() -> service.createScaffold(problemId))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not managed by JURO");
        assertThat(Files.readString(unmanagedCurrentWorkspace.resolve("notes.txt"))).isEqualTo("not created by JURO");
    }

    private LocalWorkspaceService service(ProblemService problemService, Path workspace) throws IOException {
        return new LocalWorkspaceService(
                problemService,
                settingsService(workspace),
                new LocalJavaScaffoldGenerator(objectMapper),
                objectMapper
        );
    }

    private LocalSettingsService settingsService(Path workspace) throws IOException {
        LocalSettingsService settingsService = new LocalSettingsService(objectMapper, workspace.resolve("settings.json").toString());
        LocalWorkspaceSettings defaults = LocalWorkspaceSettings.defaults();
        settingsService.saveSettings(new SaveLocalWorkspaceSettingsRequest(
                workspace.toString(),
                defaults.editor(),
                defaults.customEditorCommand(),
                defaults.aiProvider(),
                defaults.aiBaseUrl(),
                defaults.aiModel(),
                defaults.ollamaBaseUrl(),
                defaults.ollamaModel(),
                defaults.transcriptionProvider(),
                defaults.schedulerAlgorithm(),
                defaults.reviewIntensity(),
                defaults.codeReviewFrequency(),
                defaults.explanationReviewFrequency(),
                defaults.practiceFocus(),
                defaults.minimumIntervalDays(),
                defaults.maximumCodingIntervalDays(),
                defaults.maximumExplanationIntervalDays()
        ));
        return settingsService;
    }

    private Problem problem(UUID id, String slug, String title, String resultExpression) {
        Problem problem = new Problem();
        ReflectionTestUtils.setField(problem, "id", id);
        problem.setSlug(slug);
        problem.setTitle(title);
        problem.setSummary(title);
        problem.setDescriptionMarkdown("Solve " + title);
        problem.setType(ProblemType.JAVA);
        problem.setDifficulty(ProblemDifficulty.EASY);
        problem.setStarterCode("""
                class Solution {
                    public int[] solve(int[] nums, int target) {
                        %s
                    }
                }
                """.formatted(resultExpression));
        problem.setReferenceSolution(problem.getStarterCode());
        problem.setSolutionVideoUrl("https://www.youtube.com/watch?v=JUROJAVA001");
        problem.setKnowledgeRubric("Explain the algorithm, correctness, edge cases, and time and space complexity for this Java problem.");

        for (int index = 0; index < 3; index++) {
            ProblemTestCase testCase = new ProblemTestCase();
            testCase.setLabel("Case " + (index + 1));
            testCase.setSortOrder(index + 1);
            testCase.setInputData("{\"nums\":[2,7,11,15],\"target\":9}");
            testCase.setExpectedOutput("[0,1]");
            testCase.setHidden(false);
            problem.addTestCase(testCase);
        }
        return problem;
    }

    private Path testWorkspace() throws IOException {
        Path root = Path.of("target", "tmp", "local-workspace-service-test", UUID.randomUUID().toString());
        Files.createDirectories(root);
        return root.toAbsolutePath().normalize();
    }
}
