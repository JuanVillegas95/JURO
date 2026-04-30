package com.orahub.juro.submission;

import com.orahub.juro.problem.Problem;
import com.orahub.juro.problem.ProblemType;

interface SubmissionJudge {

    boolean supports(ProblemType type);

    JudgeResult judge(Problem problem, String sourceCode);
}
