package com.orahub.juro.localworkspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.model.ProblemExample;
import com.orahub.juro.problem.model.ProblemType;
import com.orahub.juro.problem.service.ProblemService;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

@Service
public class LocalWorkspaceService {

    private static final Duration RUN_TIMEOUT = Duration.ofSeconds(20);
    private static final String SCAFFOLD_MARKER = ".juro-scaffold";
    private static final String CURRENT_WORKSPACE_DIRECTORY = "juro-current";
    private static final String JURO_METADATA_DIRECTORY = ".juro";

    private final ProblemService problemService;
    private final LocalSettingsService settingsService;
    private final LocalJavaScaffoldGenerator javaScaffoldGenerator;
    private final ObjectMapper objectMapper;
    private volatile LocalProblemWorkspaceResponse activeWorkspace;
    private volatile Process activeEditorProcess;

    public LocalWorkspaceService(
            ProblemService problemService,
            LocalSettingsService settingsService,
            LocalJavaScaffoldGenerator javaScaffoldGenerator,
            ObjectMapper objectMapper
    ) {
        this.problemService = problemService;
        this.settingsService = settingsService;
        this.javaScaffoldGenerator = javaScaffoldGenerator;
        this.objectMapper = objectMapper;
    }

    public LocalToolingStatus toolingStatus() {
        LocalWorkspaceSettings settings = settingsService.getSettings();
        Path workspace = workspaceRoot(settings);
        boolean writable = false;

        try {
            Files.createDirectories(workspace);
            writable = Files.isDirectory(workspace) && Files.isWritable(workspace);
        } catch (IOException ignored) {
        }

        return new LocalToolingStatus(
                commandStatus("java", "java", "-version"),
                commandStatus("javac", "javac", "-version"),
                commandStatus("maven", "mvn", "-version"),
                settings.workspaceDirectory() != null && !settings.workspaceDirectory().isBlank(),
                writable,
                workspace.toString()
        );
    }

    public LocalProblemWorkspaceResponse createScaffold(UUID problemId) {
        Problem problem = problemService.getProblemEntity(problemId);
        Path scaffold = createProblemScaffold(problem);

        LocalProblemWorkspaceResponse response = workspaceResponse(
                problem.getId(),
                problem.getTitle(),
                problem.getSlug(),
                scaffold.toString(),
                settingsService.getSettings().editor(),
                false,
                "READY",
                null,
                false,
                null,
                "Current workspace rebuilt."
        );
        activeWorkspace = response;
        return response;
    }

    public LocalProblemWorkspaceResponse openInEditor(UUID problemId) {
        Problem problem = problemService.getProblemEntity(problemId);
        Path scaffold = createProblemScaffold(problem);
        LocalWorkspaceSettings settings = settingsService.getSettings();
        stopActiveEditorWaitProcess();
        LaunchResult launchResult = launchEditor(settings, problem, scaffold);

        LocalProblemWorkspaceResponse response = workspaceResponse(
                problem.getId(),
                problem.getTitle(),
                problem.getSlug(),
                scaffold.toString(),
                settings.editor(),
                launchResult.opened(),
                launchResult.opened() ? "OPEN" : "ERROR",
                launchResult.processId(),
                launchResult.closeDetectionAvailable(),
                launchResult.opened() ? Instant.now() : null,
                launchResult.message()
        );
        activeEditorProcess = launchResult.process();
        activeWorkspace = response;
        return response;
    }

    public LocalProblemWorkspaceResponse activeWorkspace() {
        LocalProblemWorkspaceResponse current = activeWorkspace;
        if (current == null) {
            return workspaceResponse(null, "", "", "", settingsService.getSettings().editor(), false, "NOT_OPEN", null, false, null, "No active local problem.");
        }

        Process process = activeEditorProcess;
        if (process != null && !process.isAlive()) {
            LocalProblemWorkspaceResponse closed = workspaceResponse(
                    current.problemId(),
                    current.title(),
                    current.slug(),
                    current.scaffoldPath(),
                    current.editor(),
                    false,
                    "CLOSED",
                    current.processId(),
                    true,
                    current.launchedAt(),
                    "Editor process closed."
            );
            activeEditorProcess = null;
            activeWorkspace = closed;
            return closed;
        }

        return current;
    }

    public LocalProblemWorkspaceResponse clearActiveWorkspace() {
        LocalProblemWorkspaceResponse current = activeWorkspace();
        activeWorkspace = null;
        stopActiveEditorWaitProcess();
        return current;
    }

    public LocalProblemRunResponse runTests(UUID problemId) {
        Problem problem = problemService.getProblemEntity(problemId);
        if (problem.getType() != ProblemType.JAVA) {
            throw new IllegalArgumentException("Local test execution is currently implemented for Java problems only.");
        }

        Path scaffold = scaffoldPath(problem);
        if (!Files.isDirectory(scaffold) || !isScaffoldForProblem(scaffold, problem)) {
            scaffold = createProblemScaffold(problem);
        }

        boolean windows = System.getProperty("os.name").toLowerCase(Locale.ROOT).contains("win");
        List<String> command = windows
                ? List.of("cmd", "/c", "run.bat")
                : List.of("bash", "run.sh");
        long startedAt = System.nanoTime();

        try {
            Process process = new ProcessBuilder(command)
                    .directory(scaffold.toFile())
                    .redirectErrorStream(false)
                    .start();

            boolean finished = process.waitFor(RUN_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                long runtimeMillis = elapsedMillis(startedAt);
                return new LocalProblemRunResponse(
                        problem.getId(),
                        problem.getTitle(),
                        problem.getSlug(),
                        scaffold.toString(),
                        "TIMEOUT",
                        -1,
                        runtimeMillis,
                        readProcessOutput(process.inputReader(StandardCharsets.UTF_8)),
                        "Execution exceeded %d seconds.".formatted(RUN_TIMEOUT.toSeconds()),
                        List.of()
                );
            }

            String stdout = readProcessOutput(process.inputReader(StandardCharsets.UTF_8));
            String stderr = readProcessOutput(process.errorReader(StandardCharsets.UTF_8));
            List<LocalProblemCaseResult> caseResults = parseCaseResults(stdout);
            String status = resolveRunStatus(process.exitValue(), stdout, stderr, caseResults);
            activeWorkspace = workspaceResponse(
                    problem.getId(),
                    problem.getTitle(),
                    problem.getSlug(),
                    scaffold.toString(),
                    settingsService.getSettings().editor(),
                    false,
                    "READY",
                    null,
                    false,
                    null,
                "Current workspace tested."
            );

            return new LocalProblemRunResponse(
                    problem.getId(),
                    problem.getTitle(),
                    problem.getSlug(),
                    scaffold.toString(),
                    status,
                    process.exitValue(),
                    elapsedMillis(startedAt),
                    stdout,
                    stderr,
                    caseResults
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to run local problem tests.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Local problem test run was interrupted.", exception);
        }
    }

    private Path createProblemScaffold(Problem problem) {
        if (problem.getType() != ProblemType.JAVA) {
            throw new IllegalArgumentException("JURO currently supports Java problem scaffolds only.");
        }
        if (problem.getTestCases() == null || problem.getTestCases().size() < 3) {
            throw new IllegalArgumentException("Problem %s must include at least 3 runnable test cases.".formatted(problem.getId()));
        }

        Path target = scaffoldPath(problem);

        try {
            if (Files.exists(target)) {
                if (Files.isRegularFile(target.resolve(SCAFFOLD_MARKER))) {
                    deleteRecursively(target);
                } else {
                    throw new IllegalStateException(
                            "The JURO current workspace already exists and is not managed by JURO: %s. Remove or rename it before opening a problem."
                                    .formatted(target)
                    );
                }
            }

            Files.createDirectories(target.resolve("src"));
            Files.createDirectories(target.resolve("tests"));

            Files.writeString(target.resolve(SCAFFOLD_MARKER), problem.getId().toString(), StandardCharsets.UTF_8);
            Files.writeString(target.resolve("README.md"), readme(problem), StandardCharsets.UTF_8);
            Files.writeString(target.resolve("src").resolve("Solution.java"), solutionSource(problem), StandardCharsets.UTF_8);
            Files.writeString(target.resolve("tests").resolve("cases.json"), casesJson(problem), StandardCharsets.UTF_8);

            Files.writeString(target.resolve("src").resolve("Main.java"), javaScaffoldGenerator.mainJava(problem), StandardCharsets.UTF_8);
            Files.writeString(target.resolve("run.sh"), runScript(), StandardCharsets.UTF_8);
            Files.writeString(target.resolve("run.bat"), runBatch(), StandardCharsets.UTF_8);
            makeExecutable(target.resolve("run.sh"));

            return target;
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to create local problem scaffold.", exception);
        }
    }

    private Path scaffoldPath(Problem problem) {
        Path root = workspaceRoot(settingsService.getSettings());
        Path target = root.resolve(CURRENT_WORKSPACE_DIRECTORY).toAbsolutePath().normalize();
        ensureInside(root, target);
        return target;
    }

    private Path workspaceRoot(LocalWorkspaceSettings settings) {
        if (settings.workspaceDirectory() == null || settings.workspaceDirectory().isBlank()) {
            throw new IllegalArgumentException("Workspace directory is required.");
        }

        return Path.of(settings.workspaceDirectory()).toAbsolutePath().normalize();
    }

    private void ensureInside(Path root, Path target) {
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("Refusing to operate outside the configured JURO workspace.");
        }
    }

    private boolean isScaffoldForProblem(Path scaffold, Problem problem) {
        Path marker = scaffold.resolve(SCAFFOLD_MARKER);
        if (!Files.isRegularFile(marker)) {
            return false;
        }

        try {
            return Files.readString(marker).trim().equals(problem.getId().toString());
        } catch (IOException exception) {
            return false;
        }
    }

    private String solutionSource(Problem problem) {
        if (problem.getStarterCode() != null && !problem.getStarterCode().isBlank()) {
            return problem.getStarterCode();
        }
        return """
                class Solution {
                    public int solve() {
                        return 0;
                    }
                }
                """;
    }

    private String readme(Problem problem) {
        StringBuilder builder = new StringBuilder();
        builder.append("# ").append(problem.getTitle()).append("\n\n")
                .append("Difficulty: ").append(problem.getDifficulty()).append("\n\n")
                .append(problem.getDescriptionMarkdown()).append("\n\n");

        if (problem.getConstraintsMarkdown() != null && !problem.getConstraintsMarkdown().isBlank()) {
            builder.append("## Constraints\n\n").append(problem.getConstraintsMarkdown()).append("\n\n");
        }

        builder.append("## Examples\n\n");
        problem.getExamples().stream()
                .sorted(Comparator.comparingInt(ProblemExample::getSortOrder))
                .forEach(example -> builder
                        .append("### ").append(example.getLabel()).append("\n\n")
                        .append("Input:\n\n```text\n").append(example.getInputData()).append("\n```\n\n")
                        .append("Expected output:\n\n```text\n").append(example.getExpectedOutput()).append("\n```\n\n")
                        .append(example.getExplanation() == null ? "" : example.getExplanation() + "\n\n"));

        if (problem.getStarterCode() != null && !problem.getStarterCode().isBlank()) {
            builder.append("## Expected Method Signature\n\n```java\n")
                    .append(problem.getStarterCode())
                    .append("\n```\n\n");
        }

        builder.append("## Run Tests\n\n")
                .append("```bash\n")
                .append("./run.sh\n")
                .append("```\n");

        return builder.toString();
    }

    private String casesJson(Problem problem) throws IOException {
        List<Map<String, Object>> cases = problem.getTestCases().stream()
                .sorted(Comparator.comparingInt(com.orahub.juro.problem.model.ProblemTestCase::getSortOrder))
                .map(testCase -> Map.<String, Object>of(
                        "label", testCase.getLabel(),
                        "inputData", testCase.getInputData(),
                        "expectedOutput", testCase.getExpectedOutput(),
                        "hidden", testCase.isHidden(),
                        "explanation", testCase.getExplanation() == null ? "" : testCase.getExplanation()
                ))
                .toList();
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(cases);
    }

    private String runScript() {
        return """
                #!/usr/bin/env bash
                set -euo pipefail

                mkdir -p out
                javac -d out src/*.java
                java -cp out Main tests/cases.json
                """;
    }

    private String runBatch() {
        return """
                @echo off
                if not exist out mkdir out
                javac -d out src\\*.java
                java -cp out Main tests\\cases.json
                """;
    }

    private void makeExecutable(Path path) {
        try {
            Files.setPosixFilePermissions(path, EnumSet.of(
                    PosixFilePermission.OWNER_READ,
                    PosixFilePermission.OWNER_WRITE,
                    PosixFilePermission.OWNER_EXECUTE,
                    PosixFilePermission.GROUP_READ,
                    PosixFilePermission.GROUP_EXECUTE,
                    PosixFilePermission.OTHERS_READ,
                    PosixFilePermission.OTHERS_EXECUTE
            ));
        } catch (UnsupportedOperationException | IOException ignored) {
        }
    }

    private void deleteRecursively(Path target) throws IOException {
        try (Stream<Path> walk = Files.walk(target)) {
            walk.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException exception) {
                    throw new IllegalStateException("Unable to delete %s".formatted(path), exception);
                }
            });
        }
    }

    private LaunchResult launchEditor(LocalWorkspaceSettings settings, Problem problem, Path scaffold) {
        List<String> command = editorCommand(settings, problem, scaffold);
        if (command.isEmpty()) {
            return new LaunchResult(false, "No editor command is configured.", null, null, false);
        }

        try {
            Process process = new ProcessBuilder(command).start();
            boolean detectsClose = command.contains("--wait");
            return new LaunchResult(
                    true,
                    launchMessage(settings, scaffold),
                    detectsClose ? process : null,
                    process.pid(),
                    detectsClose
            );
        } catch (IOException firstFailure) {
            if (settings.editor().equals("VS_CODE") && isMac()) {
                try {
                    Process process = new ProcessBuilder("open", "-a", "Visual Studio Code", scaffold.toString()).start();
                    return new LaunchResult(true, "Opened %s with Visual Studio Code. Close detection is not available through macOS open.".formatted(scaffold), null, process.pid(), false);
                } catch (IOException ignored) {
                    return new LaunchResult(false, firstFailure.getMessage(), null, null, false);
                }
            }

            return new LaunchResult(false, firstFailure.getMessage(), null, null, false);
        }
    }

    private List<String> editorCommand(LocalWorkspaceSettings settings, Problem problem, Path scaffold) {
        return switch (settings.editor()) {
            case "VS_CODE" -> dedicatedVsCodeCommand(settings, problem, scaffold);
            case "NVIM" -> neovimCommand(scaffold);
            default -> List.of();
        };
    }

    private List<String> neovimCommand(Path scaffold) {
        String scaffoldPath = scaffold.toAbsolutePath().normalize().toString();
        if (isMac()) {
            String shellCommand = "cd " + shellQuote(scaffoldPath) + " && nvim .";
            return List.of(
                    "osascript",
                    "-e", "tell application \"Terminal\" to activate",
                    "-e", "tell application \"Terminal\" to do script " + appleScriptString(shellCommand)
            );
        }

        if (isWindows()) {
            return List.of("cmd", "/c", "start", "JURO - Neovim", "/D", scaffoldPath, "nvim", ".");
        }

        return List.of(
                "sh",
                "-lc",
                "cd " + shellQuote(scaffoldPath) + " && exec \"${TERMINAL:-x-terminal-emulator}\" -e nvim ."
        );
    }

    private List<String> dedicatedVsCodeCommand(LocalWorkspaceSettings settings, Problem problem, Path scaffold) {
        try {
            Path metadataRoot = juroMetadataRoot(settings);
            Path userDataDirectory = metadataRoot.resolve("vscode-user-data").toAbsolutePath().normalize();
            Path workspaceFile = writeVsCodeWorkspace(settings, problem, scaffold);
            ensureInside(metadataRoot, userDataDirectory);
            ensureInside(metadataRoot, workspaceFile);
            Files.createDirectories(userDataDirectory);

            return List.of(
                    "code",
                    "--user-data-dir", userDataDirectory.toString(),
                    "--reuse-window",
                    "--wait",
                    workspaceFile.toString()
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to prepare the dedicated JURO VS Code workspace.", exception);
        }
    }

    private Path writeVsCodeWorkspace(LocalWorkspaceSettings settings, Problem problem, Path scaffold) throws IOException {
        Path metadataRoot = juroMetadataRoot(settings);
        Files.createDirectories(metadataRoot);

        Path workspaceFile = metadataRoot.resolve("current.code-workspace").toAbsolutePath().normalize();
        ensureInside(metadataRoot, workspaceFile);

        Map<String, Object> workspace = Map.of(
                "folders", List.of(Map.of(
                        "name", "JURO - %s".formatted(problem.getTitle()),
                        "path", scaffold.toString()
                )),
                "settings", Map.of(
                        "window.title", "JURO - ${rootName}${separator}${activeEditorShort}"
                )
        );
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(workspaceFile.toFile(), workspace);
        return workspaceFile;
    }

    private Path juroMetadataRoot(LocalWorkspaceSettings settings) {
        Path root = workspaceRoot(settings);
        Path metadataRoot = root.resolve(JURO_METADATA_DIRECTORY).toAbsolutePath().normalize();
        ensureInside(root, metadataRoot);
        return metadataRoot;
    }

    private void stopActiveEditorWaitProcess() {
        Process process = activeEditorProcess;
        if (process != null && process.isAlive()) {
            process.destroy();
        }
        activeEditorProcess = null;
    }

    private String launchMessage(LocalWorkspaceSettings settings, Path scaffold) {
        if (settings.editor().equals("VS_CODE")) {
            return "Opened %s in JURO's dedicated VS Code window.".formatted(scaffold);
        }
        if (settings.editor().equals("NVIM")) {
            return "Opened %s in Neovim.".formatted(scaffold);
        }
        return "Opened %s.".formatted(scaffold);
    }

    private ToolCommandStatus commandStatus(String name, String... command) {
        try {
            Process process = new ProcessBuilder(command).start();
            boolean finished = process.waitFor(2, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return new ToolCommandStatus(name, false, "", "Timed out while checking %s.".formatted(name));
            }

            String output = readProcessOutput(process.inputReader(StandardCharsets.UTF_8));
            String error = readProcessOutput(process.errorReader(StandardCharsets.UTF_8));
            String combined = (output + "\n" + error).trim();
            return new ToolCommandStatus(name, process.exitValue() == 0, firstLine(combined), combined);
        } catch (IOException exception) {
            return new ToolCommandStatus(name, false, "", exception.getMessage());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return new ToolCommandStatus(name, false, "", "Interrupted while checking %s.".formatted(name));
        }
    }

    private String readProcessOutput(java.io.BufferedReader reader) throws IOException {
        StringBuilder builder = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            builder.append(line).append('\n');
        }
        return builder.toString().trim();
    }

    private List<LocalProblemCaseResult> parseCaseResults(String stdout) {
        List<LocalProblemCaseResult> cases = new ArrayList<>();
        for (String line : stdout.split("\\R")) {
            if (!line.startsWith("JURO_CASE ")) {
                continue;
            }

            try {
                cases.add(objectMapper.readValue(
                        line.substring("JURO_CASE ".length()),
                        LocalProblemCaseResult.class
                ));
            } catch (IOException ignored) {
            }
        }
        return cases;
    }

    private String resolveRunStatus(int exitCode, String stdout, String stderr, List<LocalProblemCaseResult> caseResults) {
        if (!caseResults.isEmpty()) {
            return caseResults.stream().allMatch(LocalProblemCaseResult::passed) ? "PASSED" : "FAILED";
        }
        String combined = (stdout + "\n" + stderr).toLowerCase(Locale.ROOT);
        if (combined.contains("error:") || combined.contains("compilation failed")) {
            return "COMPILE_ERROR";
        }
        return exitCode == 0 ? "PASSED" : "RUNTIME_ERROR";
    }

    private long elapsedMillis(long startedAt) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
    }

    private String firstLine(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.lines()
                .filter(line -> !line.startsWith("Picked up _JAVA_OPTIONS"))
                .findFirst()
                .orElse(value.lines().findFirst().orElse(""));
    }

    private boolean isMac() {
        return System.getProperty("os.name").toLowerCase(Locale.ROOT).contains("mac");
    }

    private boolean isWindows() {
        return System.getProperty("os.name").toLowerCase(Locale.ROOT).contains("win");
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private String appleScriptString(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private LocalProblemWorkspaceResponse workspaceResponse(
            UUID problemId,
            String title,
            String slug,
            String scaffoldPath,
            String editor,
            boolean opened,
            String status,
            Long processId,
            boolean closeDetectionAvailable,
            Instant launchedAt,
            String message
    ) {
        return new LocalProblemWorkspaceResponse(
                problemId,
                title,
                slug,
                scaffoldPath,
                editor,
                opened,
                status,
                processId,
                closeDetectionAvailable,
                launchedAt,
                message
        );
    }

    private record LaunchResult(
            boolean opened,
            String message,
            Process process,
            Long processId,
            boolean closeDetectionAvailable
    ) {
    }
}
