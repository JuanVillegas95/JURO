package com.orahub.juro.localworkspace;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.model.ProblemTestCase;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
class LocalJavaScaffoldGenerator {

    private static final Pattern SOLVE_METHOD_PATTERN = Pattern.compile(
            "public\\s+([\\w<>\\[\\]]+)\\s+solve\\s*\\(([^)]*)\\)",
            Pattern.MULTILINE
    );

    private final ObjectMapper objectMapper;

    LocalJavaScaffoldGenerator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    String mainJava(Problem problem) {
        MethodSignature signature = parseSignature(problem);
        StringBuilder cases = new StringBuilder();
        List<ProblemTestCase> testCases = problem.getTestCases().stream()
                .sorted(Comparator.comparingInt(ProblemTestCase::getSortOrder))
                .toList();

        for (ProblemTestCase testCase : testCases) {
            cases.append("        runCase(")
                    .append(quote(testCase.getLabel()))
                    .append(", ")
                    .append(quote(testCase.getInputData()))
                    .append(", () -> solution.solve(")
                    .append(argumentsFor(signature, testCase))
                    .append("), ")
                    .append(expectedFor(signature.returnType(), testCase))
                    .append(");\n");
        }

        return """
                import java.util.Arrays;
                import java.util.Objects;

                public class Main {
                    private static int passedCount = 0;
                    private static int totalCount = 0;

                    @FunctionalInterface
                    private interface CaseRunner {
                        Object run() throws Exception;
                    }

                    public static void main(String[] args) throws Exception {
                        Solution solution = new Solution();
                %s
                        String status = passedCount == totalCount ? "PASSED" : "FAILED";
                        System.out.println("JURO_RESULT " + jsonResult(status, passedCount, totalCount));
                        if (passedCount != totalCount) {
                            System.exit(1);
                        }
                    }

                    private static void runCase(String label, String inputData, CaseRunner runner, Object expected) {
                        totalCount++;
                        long startedAt = System.nanoTime();
                        boolean passed = false;
                        String actualOutput;
                        String note;

                        try {
                            Object actual = runner.run();
                            passed = valuesEqual(actual, expected);
                            if (passed) {
                                passedCount++;
                            }
                            actualOutput = formatValue(actual);
                            note = passed ? "Actual output matched the expected result." : "Actual output did not match the expected result.";
                        } catch (Throwable throwable) {
                            actualOutput = "Runtime error: " + throwable.getClass().getSimpleName();
                            note = throwable.getMessage() == null ? "The submitted code threw an exception." : throwable.getMessage();
                        }

                        long runtimeMillis = (System.nanoTime() - startedAt) / 1_000_000L;
                        System.out.println("JURO_CASE " + jsonCase(label, passed, inputData, formatValue(expected), actualOutput, note, runtimeMillis));
                    }

                    private static boolean valuesEqual(Object actual, Object expected) {
                        if (actual instanceof int[] actualArray && expected instanceof int[] expectedArray) {
                            return Arrays.equals(actualArray, expectedArray);
                        }
                        if (actual instanceof long[] actualArray && expected instanceof long[] expectedArray) {
                            return Arrays.equals(actualArray, expectedArray);
                        }
                        if (actual instanceof double[] actualArray && expected instanceof double[] expectedArray) {
                            return Arrays.equals(actualArray, expectedArray);
                        }
                        if (actual instanceof boolean[] actualArray && expected instanceof boolean[] expectedArray) {
                            return Arrays.equals(actualArray, expectedArray);
                        }
                        if (actual instanceof Object[] actualArray && expected instanceof Object[] expectedArray) {
                            return Arrays.deepEquals(actualArray, expectedArray);
                        }
                        if (actual instanceof Number actualNumber && expected instanceof Number expectedNumber) {
                            return Math.abs(actualNumber.doubleValue() - expectedNumber.doubleValue()) < 0.000000001d;
                        }
                        return Objects.equals(actual, expected);
                    }

                    private static String formatValue(Object value) {
                        if (value == null) {
                            return "null";
                        }
                        if (value instanceof int[] array) {
                            return Arrays.toString(array);
                        }
                        if (value instanceof long[] array) {
                            return Arrays.toString(array);
                        }
                        if (value instanceof double[] array) {
                            return Arrays.toString(array);
                        }
                        if (value instanceof boolean[] array) {
                            return Arrays.toString(array);
                        }
                        if (value instanceof Object[] array) {
                            return Arrays.deepToString(array);
                        }
                        return String.valueOf(value);
                    }

                    private static String jsonResult(String status, int passed, int total) {
                        return "{"
                                + "\\\"status\\\":" + json(status)
                                + ",\\\"passed\\\":" + passed
                                + ",\\\"total\\\":" + total
                                + "}";
                    }

                    private static String jsonCase(String label, boolean passed, String inputData, String expectedOutput, String actualOutput, String note, long runtimeMillis) {
                        return "{"
                                + "\\\"label\\\":" + json(label)
                                + ",\\\"passed\\\":" + passed
                                + ",\\\"inputData\\\":" + json(inputData)
                                + ",\\\"expectedOutput\\\":" + json(expectedOutput)
                                + ",\\\"actualOutput\\\":" + json(actualOutput)
                                + ",\\\"note\\\":" + json(note)
                                + ",\\\"runtimeMillis\\\":" + runtimeMillis
                                + "}";
                    }

                    private static String json(String value) {
                        if (value == null) {
                            return "null";
                        }
                        return "\\\"" + value
                                .replace("\\\\", "\\\\\\\\")
                                .replace("\\\"", "\\\\\\\"")
                                .replace("\\n", "\\\\n")
                                .replace("\\r", "\\\\r")
                                .replace("\\t", "\\\\t")
                                + "\\\"";
                    }
                }
                """.formatted(cases);
    }

    private MethodSignature parseSignature(Problem problem) {
        String source = firstText(problem.getStarterCode(), problem.getReferenceSolution());
        Matcher matcher = SOLVE_METHOD_PATTERN.matcher(source);
        if (!matcher.find()) {
            throw new IllegalArgumentException("Problem %s does not have a Java solve method signature.".formatted(problem.getId()));
        }

        List<MethodParameter> parameters = new ArrayList<>();
        String rawParameters = matcher.group(2).trim();
        if (!rawParameters.isBlank()) {
            for (String rawParameter : rawParameters.split(",")) {
                String[] pieces = rawParameter.trim().split("\\s+");
                if (pieces.length < 2) {
                    throw new IllegalArgumentException("Unable to parse Java parameter '%s'.".formatted(rawParameter));
                }
                parameters.add(new MethodParameter(pieces[0], pieces[1]));
            }
        }

        return new MethodSignature(matcher.group(1), parameters);
    }

    private String argumentsFor(MethodSignature signature, ProblemTestCase testCase) {
        try {
            JsonNode inputNode = objectMapper.readTree(testCase.getInputData());
            List<String> arguments = new ArrayList<>();
            List<JsonNode> positionalNodes = new ArrayList<>();
            if (inputNode.isObject()) {
                inputNode.elements().forEachRemaining(positionalNodes::add);
            }

            for (int index = 0; index < signature.parameters().size(); index++) {
                MethodParameter parameter = signature.parameters().get(index);
                JsonNode parameterNode = resolveInputNode(inputNode, positionalNodes, parameter.name(), index);
                arguments.add(javaLiteral(parameter.type(), parameterNode));
            }

            return String.join(", ", arguments);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Unable to generate Java case input for %s.".formatted(testCase.getLabel()), exception);
        }
    }

    private String expectedFor(String returnType, ProblemTestCase testCase) {
        try {
            return javaLiteral(returnType, objectMapper.readTree(testCase.getExpectedOutput()));
        } catch (Exception exception) {
            throw new IllegalArgumentException("Unable to generate Java expected output for %s.".formatted(testCase.getLabel()), exception);
        }
    }

    private JsonNode resolveInputNode(JsonNode inputNode, List<JsonNode> positionalNodes, String name, int index) {
        if (inputNode.isObject()) {
            JsonNode named = inputNode.get(name);
            if (named != null) {
                return named;
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

    private String javaLiteral(String type, JsonNode node) {
        return switch (type) {
            case "int" -> Integer.toString(node.asInt());
            case "long" -> node.asLong() + "L";
            case "double" -> Double.toString(node.asDouble()) + "d";
            case "boolean" -> Boolean.toString(node.asBoolean());
            case "String" -> quote(node.asText());
            case "int[]" -> primitiveArrayLiteral("int", node);
            case "long[]" -> primitiveArrayLiteral("long", node);
            case "double[]" -> primitiveArrayLiteral("double", node);
            case "boolean[]" -> primitiveArrayLiteral("boolean", node);
            case "String[]" -> stringArrayLiteral(node);
            case "int[][]" -> nestedArrayLiteral("int", node);
            case "long[][]" -> nestedArrayLiteral("long", node);
            case "double[][]" -> nestedArrayLiteral("double", node);
            case "String[][]" -> nestedStringArrayLiteral(node);
            default -> throw new IllegalArgumentException("Unsupported Java scaffold type: %s".formatted(type));
        };
    }

    private String primitiveArrayLiteral(String primitiveType, JsonNode node) {
        List<String> values = new ArrayList<>();
        node.forEach(value -> values.add(javaLiteral(primitiveType, value)));
        return "new %s[]{%s}".formatted(primitiveType, String.join(", ", values));
    }

    private String nestedArrayLiteral(String primitiveType, JsonNode node) {
        List<String> rows = new ArrayList<>();
        node.forEach(row -> rows.add(primitiveArrayLiteral(primitiveType, row)));
        return "new %s[][]{%s}".formatted(primitiveType, String.join(", ", rows));
    }

    private String stringArrayLiteral(JsonNode node) {
        List<String> values = new ArrayList<>();
        node.forEach(value -> values.add(javaLiteral("String", value)));
        return "new String[]{%s}".formatted(String.join(", ", values));
    }

    private String nestedStringArrayLiteral(JsonNode node) {
        List<String> rows = new ArrayList<>();
        node.forEach(row -> rows.add(stringArrayLiteral(row)));
        return "new String[][]{%s}".formatted(String.join(", ", rows));
    }

    private String quote(String value) {
        return "\"" + value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t")
                + "\"";
    }

    private String firstText(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        if (second != null && !second.isBlank()) {
            return second;
        }
        return "";
    }

    private record MethodSignature(String returnType, List<MethodParameter> parameters) {
    }

    private record MethodParameter(String type, String name) {
    }
}
