package com.orahub.juro.review.controller;

import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.service.ProblemService;
import com.orahub.juro.review.dto.ReviewGradeRequest;
import com.orahub.juro.review.dto.ReviewStateResponse;
import com.orahub.juro.review.service.ProblemReviewService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/problems/{problemId}/review-results")
public class ProblemReviewController {

    private final ProblemService problemService;
    private final ProblemReviewService reviewService;

    public ProblemReviewController(ProblemService problemService, ProblemReviewService reviewService) {
        this.problemService = problemService;
        this.reviewService = reviewService;
    }

    @PostMapping
    public ReviewStateResponse recordReviewResult(
            @PathVariable UUID problemId,
            @Valid @RequestBody ReviewGradeRequest request
    ) {
        Problem problem = problemService.getProblemEntity(problemId);
        return reviewService.recordManualResult(problem, request.track(), request.passed());
    }
}
