package com.orahub.juro.submission.judge;

import com.orahub.juro.problem.model.Problem;
import com.orahub.juro.problem.model.ProblemType;

interface SubmissionJudge {

    boolean supports(ProblemType type);

    JudgeResult judge(Problem problem, String sourceCode);
}
