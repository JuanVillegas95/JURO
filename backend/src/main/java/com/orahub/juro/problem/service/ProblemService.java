package com.orahub.juro.problem.service;

import com.orahub.juro.problem.dto.ProblemDetailResponse;
import com.orahub.juro.problem.dto.ProblemExampleRequest;
import com.orahub.juro.problem.dto.ProblemRequest;
import com.orahub.juro.problem.dto.ProblemSummaryResponse;
import com.orahub.juro.problem.dto.ProblemTestCaseRequest;
import com.orahub.juro.problem.mapper.ProblemMapper;
import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.model.ProblemExample;
import com.orahub.juro.problem.model.ProblemTestCase;
import com.orahub.juro.problem.model.ProblemType;
import com.orahub.juro.problem.repository.ProblemRepository;
import com.orahub.juro.review.model.ReviewTrack;
import com.orahub.juro.review.service.ProblemReviewService;
import com.orahub.juro.shared.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@Transactional
public class ProblemService {

    private static final Pattern YOUTUBE_URL_PATTERN = Pattern.compile(
            "^https?://(www\\.)?(youtube\\.com/(watch\\?v=|embed/)|youtu\\.be/)[A-Za-z0-9_-]+.*$",
            Pattern.CASE_INSENSITIVE
    );

    private final ProblemRepository problemRepository;
    private final ProblemReviewService reviewService;

    public ProblemService(ProblemRepository problemRepository, ProblemReviewService reviewService) {
        this.problemRepository = problemRepository;
        this.reviewService = reviewService;
    }

    public List<ProblemSummaryResponse> listProblems() {
        return problemRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(problem -> problem.getType() == ProblemType.JAVA)
                .map(problem -> {
                    var states = reviewService.ensureStates(problem);
                    return ProblemMapper.toSummary(problem, states.get(ReviewTrack.CODING), states.get(ReviewTrack.EXPLANATION));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public ProblemDetailResponse getProblem(UUID id) {
        return ProblemMapper.toDetail(findProblem(id));
    }

    public ProblemDetailResponse createProblem(ProblemRequest request) {
        validateRequest(request);

        Problem problem = new Problem();
        problem.setTitle(request.title().trim());
        problem.setSlug(resolveUniqueSlug(request.slug(), request.title()));
        problem.setSummary(request.summary().trim());
        problem.setDescriptionMarkdown(request.descriptionMarkdown().trim());
        problem.setConstraintsMarkdown(trimToNull(request.constraintsMarkdown()));
        problem.setType(request.type());
        problem.setDifficulty(request.difficulty());
        problem.setStarterCode(trimToNull(request.starterCode()));
        problem.setReferenceSolution(trimToNull(request.referenceSolution()));
        problem.setEvaluationNotes(trimToNull(request.evaluationNotes()));
        problem.setSolutionVideoUrl(trimToNull(request.solutionVideoUrl()));
        problem.setKnowledgeRubric(request.knowledgeRubric().trim());

        List<ProblemExample> examples = request.examples().stream()
                .sorted(Comparator.comparingInt(ProblemExampleRequest::sortOrder))
                .map(this::toExampleEntity)
                .toList();
        problem.replaceExamples(examples);
        problem.replaceTestCases(testCaseEntities(request));

        Problem saved = problemRepository.save(problem);
        reviewService.ensureStates(saved);
        return ProblemMapper.toDetail(saved);
    }

    public ProblemDetailResponse updateProblem(UUID id, ProblemRequest request) {
        validateRequest(request);
        Problem problem = findProblem(id);
        problem.setTitle(request.title().trim());
        problem.setSlug(resolveUniqueSlugForUpdate(id, request.slug(), request.title()));
        problem.setSummary(request.summary().trim());
        problem.setDescriptionMarkdown(request.descriptionMarkdown().trim());
        problem.setConstraintsMarkdown(trimToNull(request.constraintsMarkdown()));
        problem.setType(request.type());
        problem.setDifficulty(request.difficulty());
        problem.setStarterCode(trimToNull(request.starterCode()));
        problem.setReferenceSolution(trimToNull(request.referenceSolution()));
        problem.setEvaluationNotes(trimToNull(request.evaluationNotes()));
        problem.setSolutionVideoUrl(trimToNull(request.solutionVideoUrl()));
        problem.setKnowledgeRubric(request.knowledgeRubric().trim());
        problem.replaceExamples(request.examples().stream()
                .sorted(Comparator.comparingInt(ProblemExampleRequest::sortOrder))
                .map(this::toExampleEntity)
                .toList());
        problem.replaceTestCases(testCaseEntities(request));
        return ProblemMapper.toDetail(problemRepository.save(problem));
    }

    public void deleteProblem(UUID id) {
        Problem problem = findProblem(id);
        problemRepository.delete(problem);
    }

    public Problem getProblemEntity(UUID id) {
        return findProblem(id);
    }

    private Problem findProblem(UUID id) {
        Problem problem = problemRepository.findDetailedById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Problem %s was not found".formatted(id)));
        problem.getExamples().size();
        problem.getTestCases().size();
        return problem;
    }

    private void validateRequest(ProblemRequest request) {
        if (request.type() != ProblemType.JAVA) {
            throw new IllegalArgumentException("JURO currently supports Java problems only.");
        }
        if (request.examples() == null || request.examples().size() < 3) {
            throw new IllegalArgumentException("Problems must include at least 3 examples.");
        }
        if (request.testCases() == null || request.testCases().size() < 3) {
            throw new IllegalArgumentException("Problems must include at least 3 runnable test cases.");
        }
        String solutionVideoUrl = trimToNull(request.solutionVideoUrl());
        if (solutionVideoUrl != null && !YOUTUBE_URL_PATTERN.matcher(solutionVideoUrl).matches()) {
            throw new IllegalArgumentException("Solution video must be a valid YouTube URL when provided.");
        }
        String knowledgeRubric = trimToNull(request.knowledgeRubric());
        if (knowledgeRubric == null || knowledgeRubric.length() < 50) {
            throw new IllegalArgumentException("Knowledge rubric must be at least 50 characters.");
        }
    }

    private ProblemExample toExampleEntity(ProblemExampleRequest request) {
        ProblemExample example = new ProblemExample();
        example.setLabel(request.label().trim());
        example.setSortOrder(request.sortOrder());
        example.setInputData(request.inputData().trim());
        example.setExpectedOutput(request.expectedOutput().trim());
        example.setExplanation(trimToNull(request.explanation()));
        return example;
    }

    private List<ProblemTestCase> testCaseEntities(ProblemRequest request) {
        return request.testCases().stream()
                .sorted(Comparator.comparingInt(ProblemTestCaseRequest::sortOrder))
                .map(this::toTestCaseEntity)
                .toList();
    }

    private ProblemTestCase toTestCaseEntity(ProblemTestCaseRequest request) {
        ProblemTestCase testCase = new ProblemTestCase();
        testCase.setLabel(request.label().trim());
        testCase.setSortOrder(request.sortOrder());
        testCase.setInputData(request.inputData().trim());
        testCase.setExpectedOutput(request.expectedOutput().trim());
        testCase.setHidden(request.hidden());
        testCase.setExplanation(trimToNull(request.explanation()));
        return testCase;
    }

    private String resolveUniqueSlug(String requestedSlug, String title) {
        String baseSlug = slugify(trimToNull(requestedSlug) != null ? requestedSlug : title);
        String candidate = baseSlug;
        int suffix = 2;
        while (problemRepository.existsBySlug(candidate)) {
            candidate = "%s-%d".formatted(baseSlug, suffix++);
        }
        return candidate;
    }

    private String resolveUniqueSlugForUpdate(UUID id, String requestedSlug, String title) {
        String baseSlug = slugify(trimToNull(requestedSlug) != null ? requestedSlug : title);
        String candidate = baseSlug;
        int suffix = 2;
        while (problemRepository.findBySlug(candidate)
                .map(problem -> !problem.getId().equals(id))
                .orElse(false)) {
            candidate = "%s-%d".formatted(baseSlug, suffix++);
        }
        return candidate;
    }

    private String slugify(String input) {
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        String slug = normalized.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return slug.isBlank() ? "problem" : slug;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
