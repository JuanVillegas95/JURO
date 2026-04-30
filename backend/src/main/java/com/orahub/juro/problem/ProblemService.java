package com.orahub.juro.problem;

import com.orahub.juro.shared.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class ProblemService {

    private final ProblemRepository problemRepository;

    public ProblemService(ProblemRepository problemRepository) {
        this.problemRepository = problemRepository;
    }

    @Transactional(readOnly = true)
    public List<ProblemSummaryResponse> listProblems() {
        return problemRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(ProblemMapper::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProblemDetailResponse getProblem(UUID id) {
        return ProblemMapper.toDetail(findProblem(id));
    }

    public ProblemDetailResponse createProblem(ProblemRequest request) {
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

        List<ProblemExample> examples = request.examples().stream()
                .sorted(Comparator.comparingInt(ProblemExampleRequest::sortOrder))
                .map(this::toEntity)
                .toList();
        problem.replaceExamples(examples);

        return ProblemMapper.toDetail(problemRepository.save(problem));
    }

    public Problem getProblemEntity(UUID id) {
        return findProblem(id);
    }

    private Problem findProblem(UUID id) {
        return problemRepository.findDetailedById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Problem %s was not found".formatted(id)));
    }

    private ProblemExample toEntity(ProblemExampleRequest request) {
        ProblemExample example = new ProblemExample();
        example.setLabel(request.label().trim());
        example.setSortOrder(request.sortOrder());
        example.setInputData(request.inputData().trim());
        example.setExpectedOutput(request.expectedOutput().trim());
        example.setExplanation(trimToNull(request.explanation()));
        return example;
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
