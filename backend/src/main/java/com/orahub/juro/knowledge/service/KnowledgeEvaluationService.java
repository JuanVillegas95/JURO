package com.orahub.juro.knowledge.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orahub.juro.knowledge.dto.KnowledgeEvaluationResponse;
import com.orahub.juro.localworkspace.AiEvaluationGateway;
import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.service.ProblemService;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class KnowledgeEvaluationService {

    private final ProblemService problemService;
    private final AiEvaluationGateway aiEvaluationGateway;
    private final ObjectMapper objectMapper;

    public KnowledgeEvaluationService(
            ProblemService problemService,
            AiEvaluationGateway aiEvaluationGateway,
            ObjectMapper objectMapper
    ) {
        this.problemService = problemService;
        this.aiEvaluationGateway = aiEvaluationGateway;
        this.objectMapper = objectMapper;
    }

    public KnowledgeEvaluationResponse evaluate(UUID problemId, String transcript) {
        Problem problem = problemService.getProblemEntity(problemId);
        if (problem.getKnowledgeRubric() == null || problem.getKnowledgeRubric().isBlank()) {
            throw new IllegalArgumentException("Problem %s is missing a knowledge rubric.".formatted(problemId));
        }

        try {
            String generatedJson = aiEvaluationGateway.generateJson(prompt(problem, transcript));
            return parseResponse(generatedJson);
        } catch (Exception exception) {
            return new KnowledgeEvaluationResponse(
                    "ERROR",
                    0,
                    "Unable to evaluate the explanation.",
                    List.of("The configured local AI evaluator is unavailable or returned an invalid response."),
                    List.of(),
                    exception.getMessage() == null ? "Check AI evaluation settings and try again." : exception.getMessage(),
                    aiEvaluationGateway.modelLabel(),
                    Instant.now()
            );
        }
    }

    private KnowledgeEvaluationResponse parseResponse(String generatedJson) throws Exception {
        JsonNode root = objectMapper.readTree(extractJsonObject(generatedJson));
        int score = Math.max(0, Math.min(100, root.path("score").asInt(0)));
        String status = root.path("status").asText(score >= 70 ? "PASSED" : "FAILED").toUpperCase();
        if (!status.equals("PASSED") && !status.equals("NEEDS_REVIEW") && !status.equals("FAILED")) {
            status = score >= 90 ? "PASSED" : score >= 70 ? "NEEDS_REVIEW" : "FAILED";
        }

        return new KnowledgeEvaluationResponse(
                status,
                score,
                text(root, "summary", "No summary returned."),
                strings(root.get("missingConcepts")),
                strings(root.get("strengths")),
                text(root, "suggestedReview", ""),
                aiEvaluationGateway.modelLabel(),
                Instant.now()
        );
    }

    private String extractJsonObject(String generatedJson) {
        String text = generatedJson == null ? "" : generatedJson.trim();
        if (text.startsWith("```")) {
            int firstLineBreak = text.indexOf('\n');
            int closingFence = text.lastIndexOf("```");
            if (firstLineBreak >= 0 && closingFence > firstLineBreak) {
                text = text.substring(firstLineBreak + 1, closingFence).trim();
            }
        }

        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return text;
    }

    private String prompt(Problem problem, String transcript) {
        return """
                You are evaluating a learner's spoken explanation for a Java coding problem.
                Compare the learner transcript to the rubric. Do not require exact wording.
                Reward correct conceptual understanding. Check algorithm idea, data structures,
                edge cases, complexity, and why the approach works.

                Return only JSON with this exact shape:
                {
                  "status": "PASSED" | "NEEDS_REVIEW" | "FAILED",
                  "score": 0,
                  "summary": "...",
                  "missingConcepts": ["..."],
                  "strengths": ["..."],
                  "suggestedReview": "..."
                }

                Problem title:
                %s

                Problem description:
                %s

                Knowledge rubric:
                %s

                Learner transcript:
                %s
                """.formatted(
                problem.getTitle(),
                problem.getDescriptionMarkdown(),
                problem.getKnowledgeRubric(),
                transcript
        );
    }

    private String text(JsonNode root, String field, String fallback) {
        JsonNode value = root.get(field);
        return value == null || value.asText().isBlank() ? fallback : value.asText();
    }

    private List<String> strings(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        node.forEach(value -> {
            if (!value.asText().isBlank()) {
                values.add(value.asText());
            }
        });
        return values;
    }
}
