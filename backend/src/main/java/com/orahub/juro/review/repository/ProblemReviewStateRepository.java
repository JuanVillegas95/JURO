package com.orahub.juro.review.repository;

import com.orahub.juro.review.model.ProblemReviewState;
import com.orahub.juro.review.model.ReviewTrack;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProblemReviewStateRepository extends JpaRepository<ProblemReviewState, UUID> {

    List<ProblemReviewState> findAllByProblem_Id(UUID problemId);

    Optional<ProblemReviewState> findByProblem_IdAndTrack(UUID problemId, ReviewTrack track);
}
