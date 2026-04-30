package com.orahub.juro.submission;

import com.orahub.juro.problem.Problem;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SubmissionJudgeService {

    private final List<SubmissionJudge> judges;

    public SubmissionJudgeService(List<SubmissionJudge> judges) {
        this.judges = judges;
    }

    public JudgeResult judge(Problem problem, String sourceCode) {
        return judges.stream()
                .filter(judge -> judge.supports(problem.getType()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No judge is configured for problem type %s".formatted(problem.getType())))
                .judge(problem, sourceCode);
    }
}
