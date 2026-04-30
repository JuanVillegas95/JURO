package com.orahub.juro.submission;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.orahub.juro.problem.Problem;
import com.orahub.juro.problem.ProblemExample;
import com.orahub.juro.problem.ProblemType;
import org.springframework.stereotype.Component;

import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Constructor;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Component
class JavaSubmissionJudge implements SubmissionJudge {

    private static final Duration EXECUTION_TIMEOUT = Duration.ofSeconds(3);

    private final ObjectMapper objectMapper;

    JavaSubmissionJudge(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean supports(ProblemType type) {
        return type == ProblemType.JAVA;
    }

    @Override
    public JudgeResult judge(Problem problem, String sourceCode) {
        if (sourceCode == null || sourceCode.isBlank()) {
            return JudgeResultFormatter.failure("No code to test.", "Provide a Java Solution class before running the examples.");
        }

        try (CompiledJavaSolution compiledSolution = compile(sourceCode)) {
            List<ExampleJudgeOutcome> outcomes = new ArrayList<>();

            for (ProblemExample example : orderedExamples(problem)) {
                outcomes.add(runExample(compiledSolution, example));
            }

            return JudgeResultFormatter.fromExampleRuns(outcomes);
        } catch (CompilationFailedException exception) {
            return JudgeResultFormatter.failure("Compilation failed.", exception.getMessage());
        } catch (Exception exception) {
            return JudgeResultFormatter.failure("Unable to test Java code.", exception.getMessage());
        }
    }

    private List<ProblemExample> orderedExamples(Problem problem) {
        return problem.getExamples().stream()
                .sorted(Comparator.comparingInt(ProblemExample::getSortOrder))
                .toList();
    }

    private ExampleJudgeOutcome runExample(CompiledJavaSolution compiledSolution, ProblemExample example) {
        long startedAt = System.nanoTime();
        try {
            JsonNode inputNode = objectMapper.readTree(example.getInputData());
            JsonNode expectedNode = objectMapper.readTree(example.getExpectedOutput());
            Object actualValue = compiledSolution.execute(inputNode);
            JsonNode actualNode = objectMapper.valueToTree(actualValue);
            long runtimeMillis = elapsedMillis(startedAt);

            boolean passed = jsonEquivalent(actualNode, expectedNode);
            return new ExampleJudgeOutcome(
                    example.getLabel(),
                    passed,
                    safePrettyPrint(example.getInputData()),
                    prettyPrint(expectedNode),
                    prettyPrint(actualNode),
                    passed ? "Actual output matched the expected result." : "Actual output did not match the expected result.",
                    runtimeMillis
            );
        } catch (TimeoutException exception) {
            return new ExampleJudgeOutcome(
                    example.getLabel(),
                    false,
                    safePrettyPrint(example.getInputData()),
                    safePrettyPrint(example.getExpectedOutput()),
                    "Execution timed out.",
                    "The example exceeded the %d second execution limit.".formatted(EXECUTION_TIMEOUT.toSeconds()),
                    elapsedMillis(startedAt)
            );
        } catch (InvocationTargetException exception) {
            Throwable target = exception.getTargetException();
            return new ExampleJudgeOutcome(
                    example.getLabel(),
                    false,
                    safePrettyPrint(example.getInputData()),
                    safePrettyPrint(example.getExpectedOutput()),
                    "Runtime error: %s".formatted(target.getClass().getSimpleName()),
                    Objects.toString(target.getMessage(), "The submitted code threw an exception."),
                    elapsedMillis(startedAt)
            );
        } catch (Exception exception) {
            return new ExampleJudgeOutcome(
                    example.getLabel(),
                    false,
                    safePrettyPrint(example.getInputData()),
                    safePrettyPrint(example.getExpectedOutput()),
                    "Execution error",
                    Objects.toString(exception.getMessage(), "The example could not be executed."),
                    elapsedMillis(startedAt)
            );
        }
    }

    private CompiledJavaSolution compile(String sourceCode) throws IOException, CompilationFailedException, ClassNotFoundException, NoSuchMethodException {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            throw new CompilationFailedException("A full JDK is required to compile Java submissions.");
        }

        Path workspace = Files.createTempDirectory(Path.of(System.getProperty("java.io.tmpdir")), "juro-java-");
        Path sourceFile = workspace.resolve("Solution.java");
        Path classDirectory = workspace.resolve("classes");
        Files.createDirectories(classDirectory);
        Files.writeString(sourceFile, sourceCode, StandardCharsets.UTF_8);

        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        try (StandardJavaFileManager fileManager = compiler.getStandardFileManager(diagnostics, Locale.ROOT, StandardCharsets.UTF_8)) {
            Iterable<? extends JavaFileObject> compilationUnits = fileManager.getJavaFileObjects(sourceFile.toFile());
            List<String> options = List.of(
                    "-d", classDirectory.toString(),
                    "-parameters",
                    "-encoding", StandardCharsets.UTF_8.name()
            );

            Boolean compilationSucceeded = compiler.getTask(null, fileManager, diagnostics, options, null, compilationUnits).call();
            if (!Boolean.TRUE.equals(compilationSucceeded)) {
                deleteRecursively(workspace);
                throw new CompilationFailedException(formatDiagnostics(diagnostics.getDiagnostics()));
            }
        }

        URLClassLoader classLoader = new URLClassLoader(new URL[]{classDirectory.toUri().toURL()}, getClass().getClassLoader());
        Class<?> solutionClass = Class.forName("Solution", true, classLoader);
        Method solveMethod = findSolveMethod(solutionClass);
        return new CompiledJavaSolution(workspace, classLoader, solutionClass, solveMethod, objectMapper);
    }

    private Method findSolveMethod(Class<?> solutionClass) throws NoSuchMethodException {
        return java.util.Arrays.stream(solutionClass.getDeclaredMethods())
                .filter(method -> method.getName().equals("solve"))
                .findFirst()
                .map(method -> {
                    method.setAccessible(true);
                    return method;
                })
                .orElseThrow(() -> new NoSuchMethodException("Expected a method named solve on class Solution."));
    }

    private String formatDiagnostics(List<Diagnostic<? extends JavaFileObject>> diagnostics) {
        StringBuilder builder = new StringBuilder();
        diagnostics.stream().limit(10).forEach(diagnostic -> builder
                .append("Line ")
                .append(diagnostic.getLineNumber())
                .append(": ")
                .append(diagnostic.getMessage(Locale.ROOT))
                .append('\n'));
        return builder.toString().trim();
    }

    private boolean jsonEquivalent(JsonNode actual, JsonNode expected) {
        if (actual == null || actual.isNull()) {
            return expected == null || expected.isNull();
        }

        if (expected == null || expected.isNull()) {
            return false;
        }

        if (actual.isNumber() && expected.isNumber()) {
            return actual.decimalValue().compareTo(expected.decimalValue()) == 0;
        }

        if (actual.isTextual() && expected.isTextual()) {
            return actual.textValue().equals(expected.textValue());
        }

        if (actual.isBoolean() && expected.isBoolean()) {
            return actual.booleanValue() == expected.booleanValue();
        }

        if (actual.isArray() && expected.isArray()) {
            if (actual.size() != expected.size()) {
                return false;
            }
            for (int index = 0; index < actual.size(); index++) {
                if (!jsonEquivalent(actual.get(index), expected.get(index))) {
                    return false;
                }
            }
            return true;
        }

        if (actual.isObject() && expected.isObject()) {
            if (actual.size() != expected.size()) {
                return false;
            }
            Iterator<String> fieldNames = actual.fieldNames();
            while (fieldNames.hasNext()) {
                String fieldName = fieldNames.next();
                if (!expected.has(fieldName) || !jsonEquivalent(actual.get(fieldName), expected.get(fieldName))) {
                    return false;
                }
            }
            return true;
        }

        return actual.equals(expected);
    }

    private String prettyPrint(JsonNode node) throws JsonProcessingException {
        if (node == null || node.isNull()) {
            return "null";
        }
        if (node.isContainerNode()) {
            return objectMapper.writerWithDefaultPrettyPrinter()
                    .with(SerializationFeature.WRITE_BIGDECIMAL_AS_PLAIN)
                    .writeValueAsString(node);
        }
        if (node.isTextual()) {
            return node.textValue();
        }
        return node.toString();
    }

    private String safePrettyPrint(String rawValue) {
        try {
            return prettyPrint(objectMapper.readTree(rawValue));
        } catch (Exception exception) {
            return rawValue;
        }
    }

    private long elapsedMillis(long startedAt) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
    }

    private void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }

        try (var walk = Files.walk(path)) {
            walk.sorted(Comparator.reverseOrder()).forEach(current -> {
                try {
                    Files.deleteIfExists(current);
                } catch (IOException ignored) {
                }
            });
        }
    }

    private static final class CompiledJavaSolution implements AutoCloseable {

        private final Path workspace;
        private final URLClassLoader classLoader;
        private final Class<?> solutionClass;
        private final Method solveMethod;
        private final ObjectMapper objectMapper;

        private CompiledJavaSolution(
                Path workspace,
                URLClassLoader classLoader,
                Class<?> solutionClass,
                Method solveMethod,
                ObjectMapper objectMapper
        ) {
            this.workspace = workspace;
            this.classLoader = classLoader;
            this.solutionClass = solutionClass;
            this.solveMethod = solveMethod;
            this.objectMapper = objectMapper;
        }

        private Object execute(JsonNode inputNode) throws Exception {
            Constructor<?> constructor = solutionClass.getDeclaredConstructor();
            constructor.setAccessible(true);
            Object instance = constructor.newInstance();
            Object[] arguments = buildArguments(inputNode);

            ExecutorService executorService = Executors.newSingleThreadExecutor();
            try {
                Future<Object> future = executorService.submit(() -> solveMethod.invoke(instance, arguments));
                return future.get(EXECUTION_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            } catch (ExecutionException exception) {
                Throwable cause = exception.getCause();
                if (cause instanceof InvocationTargetException invocationTargetException) {
                    throw invocationTargetException;
                }
                throw exception;
            } finally {
                executorService.shutdownNow();
            }
        }

        private Object[] buildArguments(JsonNode inputNode) {
            Parameter[] parameters = solveMethod.getParameters();
            Object[] arguments = new Object[parameters.length];
            List<JsonNode> positionalNodes = new ArrayList<>();

            if (inputNode != null && inputNode.isObject()) {
                inputNode.elements().forEachRemaining(positionalNodes::add);
            }

            for (int index = 0; index < parameters.length; index++) {
                Parameter parameter = parameters[index];
                JsonNode valueNode = resolveValueNode(inputNode, positionalNodes, parameter, index);
                arguments[index] = objectMapper.convertValue(valueNode, objectMapper.constructType(parameter.getParameterizedType()));
            }

            return arguments;
        }

        private JsonNode resolveValueNode(JsonNode inputNode, List<JsonNode> positionalNodes, Parameter parameter, int index) {
            if (inputNode == null || inputNode.isNull()) {
                return objectMapper.nullNode();
            }

            if (inputNode.isObject()) {
                JsonNode namedNode = inputNode.get(parameter.getName());
                if (namedNode != null) {
                    return namedNode;
                }
                if (index < positionalNodes.size()) {
                    return positionalNodes.get(index);
                }
            }

            if (inputNode.isArray() && inputNode.size() > index) {
                return inputNode.get(index);
            }

            return inputNode;
        }

        @Override
        public void close() throws Exception {
            classLoader.close();
            try (var walk = Files.walk(workspace)) {
                walk.sorted(Comparator.reverseOrder()).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException ignored) {
                    }
                });
            }
        }
    }

    private static final class CompilationFailedException extends Exception {

        private CompilationFailedException(String message) {
            super(message);
        }
    }
}
