package com.orahub.juro.problem.controller;

import com.orahub.juro.problem.dto.ProblemDetailResponse;
import com.orahub.juro.problem.dto.ProblemRequest;
import com.orahub.juro.problem.dto.ProblemSummaryResponse;
import com.orahub.juro.problem.service.ProblemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/problems")
public class ProblemController {

    private final ProblemService problemService;

    public ProblemController(ProblemService problemService) {
        this.problemService = problemService;
    }

    @GetMapping
    public List<ProblemSummaryResponse> listProblems() {
        return problemService.listProblems();
    }

    @GetMapping("/{id}")
    public ProblemDetailResponse getProblem(@PathVariable UUID id) {
        return problemService.getProblem(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProblemDetailResponse createProblem(@Valid @RequestBody ProblemRequest request) {
        return problemService.createProblem(request);
    }

    @PutMapping("/{id}")
    public ProblemDetailResponse updateProblem(@PathVariable UUID id, @Valid @RequestBody ProblemRequest request) {
        return problemService.updateProblem(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProblem(@PathVariable UUID id) {
        problemService.deleteProblem(id);
    }
}
