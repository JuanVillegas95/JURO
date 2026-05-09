package com.orahub.juro.submission.controller;

import com.orahub.juro.submission.dto.RunSubmissionRequest;
import com.orahub.juro.submission.dto.SubmissionResponse;
import com.orahub.juro.submission.service.SubmissionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/submissions")
public class SubmissionRunController {

    private final SubmissionService submissionService;

    public SubmissionRunController(SubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    @PostMapping
    public SubmissionResponse createSubmission(@Valid @RequestBody RunSubmissionRequest request) {
        return submissionService.createSubmission(request.problemId(), request.language(), request.code());
    }
}
