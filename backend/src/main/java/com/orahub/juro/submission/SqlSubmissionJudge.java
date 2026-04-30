package com.orahub.juro.submission;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.orahub.juro.problem.Problem;
import com.orahub.juro.problem.ProblemExample;
import com.orahub.juro.problem.ProblemType;
import org.h2.tools.RunScript;
import org.springframework.stereotype.Component;

import java.io.StringReader;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.Date;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Component
class SqlSubmissionJudge implements SubmissionJudge {

    private final ObjectMapper objectMapper;

    SqlSubmissionJudge(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean supports(ProblemType type) {
        return type == ProblemType.SQL;
    }

    @Override
    public JudgeResult judge(Problem problem, String sourceCode) {
        if (sourceCode == null || sourceCode.isBlank()) {
            return JudgeResultFormatter.failure("No code to test.", "Provide a SQL query before running the examples.");
        }

        List<ExampleJudgeOutcome> outcomes = new ArrayList<>();
        for (ProblemExample example : orderedExamples(problem)) {
            outcomes.add(runExample(example, sourceCode));
        }

        return JudgeResultFormatter.fromExampleRuns(outcomes);
    }

    private List<ProblemExample> orderedExamples(Problem problem) {
        return problem.getExamples().stream()
                .sorted(Comparator.comparingInt(ProblemExample::getSortOrder))
                .toList();
    }

    private ExampleJudgeOutcome runExample(ProblemExample example, String sourceCode) {
        long startedAt = System.nanoTime();
        try (Connection connection = DriverManager.getConnection(buildJdbcUrl())) {
            RunScript.execute(connection, new StringReader(example.getInputData()));

            try (Statement statement = connection.createStatement()) {
                boolean hasResultSet = statement.execute(sourceCode);
                if (!hasResultSet) {
                    return new ExampleJudgeOutcome(
                            example.getLabel(),
                            false,
                            example.getInputData(),
                            safePrettyPrint(example.getExpectedOutput()),
                            "No result set returned.",
                            "The submitted SQL must return a result set for comparison.",
                            elapsedMillis(startedAt)
                    );
                }

                try (ResultSet resultSet = statement.getResultSet()) {
                    JsonNode expectedNode = objectMapper.readTree(example.getExpectedOutput());
                    JsonNode actualNode = objectMapper.valueToTree(readRows(resultSet));
                    boolean passed = jsonEquivalent(actualNode, expectedNode);
                    return new ExampleJudgeOutcome(
                            example.getLabel(),
                            passed,
                            example.getInputData(),
                            prettyPrint(expectedNode),
                            prettyPrint(actualNode),
                            passed ? "Actual output matched the expected result." : "Actual output did not match the expected result.",
                            elapsedMillis(startedAt)
                    );
                }
            }
        } catch (Exception exception) {
            return new ExampleJudgeOutcome(
                    example.getLabel(),
                    false,
                    example.getInputData(),
                    safePrettyPrint(example.getExpectedOutput()),
                    "Execution error",
                    exception.getMessage() == null ? "The SQL query could not be executed." : exception.getMessage(),
                    elapsedMillis(startedAt)
            );
        }
    }

    private String buildJdbcUrl() {
        return "jdbc:h2:mem:juro_%s;MODE=PostgreSQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1".formatted(UUID.randomUUID());
    }

    private List<Map<String, Object>> readRows(ResultSet resultSet) throws Exception {
        ResultSetMetaData metadata = resultSet.getMetaData();
        List<Map<String, Object>> rows = new ArrayList<>();

        while (resultSet.next()) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (int columnIndex = 1; columnIndex <= metadata.getColumnCount(); columnIndex++) {
                String columnName = metadata.getColumnLabel(columnIndex);
                row.put(columnName, normalizeValue(resultSet.getObject(columnIndex)));
            }
            rows.add(row);
        }

        return rows;
    }

    private Object normalizeValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        if (value instanceof Date date) {
            return date.toLocalDate().toString();
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime().toString();
        }
        if (value instanceof LocalDate localDate) {
            return localDate.toString();
        }
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime.toString();
        }
        return value;
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
            for (var fields = actual.fields(); fields.hasNext(); ) {
                Map.Entry<String, JsonNode> field = fields.next();
                if (!expected.has(field.getKey()) || !jsonEquivalent(field.getValue(), expected.get(field.getKey()))) {
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
        return java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
    }
}
