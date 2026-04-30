package com.orahub.juro.submission;

import com.orahub.juro.problem.Problem;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "submissions")
public class Submission {

    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "problem_id", nullable = false)
    private Problem problem;

    @Column(nullable = false, length = 20)
    private String submittedLanguage;

    @Column(nullable = false, columnDefinition = "text")
    private String sourceCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SubmissionStatus status;

    @Column(nullable = false, columnDefinition = "text")
    private String resultSummary;

    @Column
    private Long totalRuntimeMillis;

    @Column(columnDefinition = "text")
    private String resultDetailsJson;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Problem getProblem() {
        return problem;
    }

    public void setProblem(Problem problem) {
        this.problem = problem;
    }

    public String getSubmittedLanguage() {
        return submittedLanguage;
    }

    public void setSubmittedLanguage(String submittedLanguage) {
        this.submittedLanguage = submittedLanguage;
    }

    public String getSourceCode() {
        return sourceCode;
    }

    public void setSourceCode(String sourceCode) {
        this.sourceCode = sourceCode;
    }

    public SubmissionStatus getStatus() {
        return status;
    }

    public void setStatus(SubmissionStatus status) {
        this.status = status;
    }

    public String getResultSummary() {
        return resultSummary;
    }

    public void setResultSummary(String resultSummary) {
        this.resultSummary = resultSummary;
    }

    public Long getTotalRuntimeMillis() {
        return totalRuntimeMillis;
    }

    public void setTotalRuntimeMillis(Long totalRuntimeMillis) {
        this.totalRuntimeMillis = totalRuntimeMillis;
    }

    public String getResultDetailsJson() {
        return resultDetailsJson;
    }

    public void setResultDetailsJson(String resultDetailsJson) {
        this.resultDetailsJson = resultDetailsJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
