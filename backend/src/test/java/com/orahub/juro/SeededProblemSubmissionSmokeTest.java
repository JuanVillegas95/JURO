package com.orahub.juro;

import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.repository.ProblemRepository;
import com.orahub.juro.submission.dto.SubmissionResponse;
import com.orahub.juro.submission.model.SubmissionStatus;
import com.orahub.juro.submission.service.SubmissionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Comparator;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.profiles.active=desktop",
                "spring.datasource.url=jdbc:h2:mem:seededSmoke;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
                "spring.datasource.username=sa",
                "spring.datasource.password=",
                "spring.flyway.locations=classpath:db/desktop-migration",
                "app.local.settings-path=target/tmp/juro-settings.json"
        }
)
class SeededProblemSubmissionSmokeTest {

    @Autowired
    private ProblemRepository problemRepository;

    @Autowired
    private SubmissionService submissionService;

    @Test
    void everySeededReferenceSolutionRunsSuccessfully() {
        var problems = problemRepository.findAll().stream()
                .sorted(Comparator.comparing(Problem::getSlug))
                .toList();

        assertThat(problems).isNotEmpty();

        for (Problem problem : problems) {
            assertThat(problem.getReferenceSolution())
                    .as("reference solution for %s", problem.getSlug())
                    .isNotBlank();

            SubmissionResponse response = submissionService.createSubmission(
                    problem.getId(),
                    problem.getType().name(),
                    problem.getReferenceSolution()
            );

            assertThat(response.status())
                    .as("judge status for %s%n%s", problem.getSlug(), response.resultSummary())
                    .isEqualTo(SubmissionStatus.ACCEPTED);
            assertThat(response.caseResults())
                    .as("case results for %s", problem.getSlug())
                    .hasSizeGreaterThanOrEqualTo(3)
                    .allMatch(caseResult -> caseResult.passed(), "all cases pass");
        }
    }
}
