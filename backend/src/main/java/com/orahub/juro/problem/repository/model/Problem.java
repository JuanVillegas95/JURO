package com.orahub.juro.problem.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "problems")
public class Problem {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(nullable = false, unique = true, length = 160)
    private String slug;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(nullable = false, length = 280)
    private String summary;

    @Column(nullable = false, columnDefinition = "text")
    private String descriptionMarkdown;

    @Column(columnDefinition = "text")
    private String constraintsMarkdown;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProblemType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProblemDifficulty difficulty;

    @Column(columnDefinition = "text")
    private String starterCode;

    @Column(columnDefinition = "text")
    private String referenceSolution;

    @Column(columnDefinition = "text")
    private String evaluationNotes;

    @Column(columnDefinition = "text")
    private String solutionVideoUrl;

    @Column(nullable = false, columnDefinition = "text")
    private String knowledgeRubric;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "problem", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, createdAt ASC")
    private List<ProblemExample> examples = new ArrayList<>();

    @OneToMany(mappedBy = "problem", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, createdAt ASC")
    private List<ProblemTestCase> testCases = new ArrayList<>();

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public void replaceExamples(List<ProblemExample> newExamples) {
        examples.clear();
        newExamples.forEach(this::addExample);
    }

    public void addExample(ProblemExample example) {
        example.setProblem(this);
        examples.add(example);
    }

    public void replaceTestCases(List<ProblemTestCase> newTestCases) {
        testCases.clear();
        newTestCases.forEach(this::addTestCase);
    }

    public void addTestCase(ProblemTestCase testCase) {
        testCase.setProblem(this);
        testCases.add(testCase);
    }

    public UUID getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getDescriptionMarkdown() {
        return descriptionMarkdown;
    }

    public void setDescriptionMarkdown(String descriptionMarkdown) {
        this.descriptionMarkdown = descriptionMarkdown;
    }

    public String getConstraintsMarkdown() {
        return constraintsMarkdown;
    }

    public void setConstraintsMarkdown(String constraintsMarkdown) {
        this.constraintsMarkdown = constraintsMarkdown;
    }

    public ProblemType getType() {
        return type;
    }

    public void setType(ProblemType type) {
        this.type = type;
    }

    public ProblemDifficulty getDifficulty() {
        return difficulty;
    }

    public void setDifficulty(ProblemDifficulty difficulty) {
        this.difficulty = difficulty;
    }

    public String getStarterCode() {
        return starterCode;
    }

    public void setStarterCode(String starterCode) {
        this.starterCode = starterCode;
    }

    public String getReferenceSolution() {
        return referenceSolution;
    }

    public void setReferenceSolution(String referenceSolution) {
        this.referenceSolution = referenceSolution;
    }

    public String getEvaluationNotes() {
        return evaluationNotes;
    }

    public void setEvaluationNotes(String evaluationNotes) {
        this.evaluationNotes = evaluationNotes;
    }

    public String getSolutionVideoUrl() {
        return solutionVideoUrl;
    }

    public void setSolutionVideoUrl(String solutionVideoUrl) {
        this.solutionVideoUrl = solutionVideoUrl;
    }

    public String getKnowledgeRubric() {
        return knowledgeRubric;
    }

    public void setKnowledgeRubric(String knowledgeRubric) {
        this.knowledgeRubric = knowledgeRubric;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public List<ProblemExample> getExamples() {
        return examples;
    }

    public List<ProblemTestCase> getTestCases() {
        return testCases;
    }
}
