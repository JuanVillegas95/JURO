package com.orahub.juro.submission.controller;

import com.orahub.juro.submission.dto.CreateSubmissionRequest;
import com.orahub.juro.submission.dto.SubmissionResponse;
import com.orahub.juro.submission.service.SubmissionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/problems/{problemId}/submissions")
public class SubmissionController {

    private final SubmissionService submissionService;

    public SubmissionController(SubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    @GetMapping
    public List<SubmissionResponse> listSubmissions(@PathVariable UUID problemId) {
        return submissionService.listSubmissions(problemId);
    }

    @PostMapping
    public SubmissionResponse createSubmission(
            @PathVariable UUID problemId,
            @Valid @RequestBody CreateSubmissionRequest request
    ) {
        return submissionService.createSubmission(problemId, request.submittedLanguage(), request.sourceCode());
    }
}
