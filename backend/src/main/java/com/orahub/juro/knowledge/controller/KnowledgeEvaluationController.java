package com.orahub.juro.knowledge.controller;

import com.orahub.juro.knowledge.dto.KnowledgeEvaluationRequest;
import com.orahub.juro.knowledge.dto.KnowledgeEvaluationResponse;
import com.orahub.juro.knowledge.service.KnowledgeEvaluationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/problems/{problemId}/knowledge-evaluations")
public class KnowledgeEvaluationController {

    private final KnowledgeEvaluationService evaluationService;

    public KnowledgeEvaluationController(KnowledgeEvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    @PostMapping
    public KnowledgeEvaluationResponse evaluate(
            @PathVariable UUID problemId,
            @Valid @RequestBody KnowledgeEvaluationRequest request
    ) {
        return evaluationService.evaluate(problemId, request.transcript());
    }
}
