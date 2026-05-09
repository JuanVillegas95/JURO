package com.orahub.juro.submission.repository;

import com.orahub.juro.submission.model.Submission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SubmissionRepository extends JpaRepository<Submission, UUID> {

    List<Submission> findAllByProblem_IdOrderByCreatedAtDesc(UUID problemId);

    void deleteAllByProblem_Id(UUID problemId);
}
