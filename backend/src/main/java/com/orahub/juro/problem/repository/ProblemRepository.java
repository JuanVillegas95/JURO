package com.orahub.juro.problem.repository;

import com.orahub.juro.problem.model.Problem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProblemRepository extends JpaRepository<Problem, UUID> {

    boolean existsBySlug(String slug);

    Optional<Problem> findBySlug(String slug);

    List<Problem> findAllByOrderByCreatedAtDesc();

    @Query("""
        select distinct p
        from Problem p
        left join fetch p.examples
        where p.id = :id
        """)
    Optional<Problem> findDetailedById(UUID id);
}
