alter table problems
    add column solution_video_url text,
    add column knowledge_rubric text;

delete from problems
where type <> 'JAVA';

update problems
set solution_video_url = 'https://www.youtube.com/watch?v=JUROJAVA001',
    knowledge_rubric = 'A strong explanation must describe the main algorithm, why it is correct, the data structures or state used, important edge cases, and the expected time and space complexity for this Java problem.'
where type = 'JAVA';

insert into problem_examples (
    id, problem_id, label, sort_order, input_data, expected_output, explanation, created_at
) values
('21111111-1111-1111-1111-111111111132', '11111111-1111-1111-1111-111111111111', 'Example 3', 2, '{"nums":[0,4,3,0],"target":0}', '[0,3]', 'The two zero values at indexes 0 and 3 add up to the target.', now()),
('21111111-1111-1111-1111-111111111133', '11111111-1111-1111-1111-111111111113', 'Example 2', 1, '{"x":-121}', 'false', 'Negative numbers are not palindromes.', now()),
('21111111-1111-1111-1111-111111111134', '11111111-1111-1111-1111-111111111113', 'Example 3', 2, '{"x":10}', 'false', 'The value reads as 01 from right to left.', now()),
('21111111-1111-1111-1111-111111111135', '11111111-1111-1111-1111-111111111114', 'Example 2', 1, '{"s":"([)]"}', 'false', 'The closing bracket order does not match the most recent opening bracket.', now()),
('21111111-1111-1111-1111-111111111136', '11111111-1111-1111-1111-111111111114', 'Example 3', 2, '{"s":"{[]}"}', 'true', 'Nested brackets close in the correct order.', now()),
('21111111-1111-1111-1111-111111111137', '11111111-1111-1111-1111-111111111115', 'Example 2', 1, '{"prices":[7,6,4,3,1]}', '0', 'No later day offers a profit, so the best result is zero.', now()),
('21111111-1111-1111-1111-111111111138', '11111111-1111-1111-1111-111111111115', 'Example 3', 2, '{"prices":[1,2]}', '1', 'Buy at 1 and sell at 2.', now()),
('21111111-1111-1111-1111-111111111139', '11111111-1111-1111-1111-111111111116', 'Example 2', 1, '{"words":["dog","racecar","car"]}', '""', 'There is no shared starting prefix.', now()),
('21111111-1111-1111-1111-111111111140', '11111111-1111-1111-1111-111111111116', 'Example 3', 2, '{"words":["interspecies","interstellar","interstate"]}', '"inters"', 'All words start with `inters`.', now()),
('21111111-1111-1111-1111-111111111141', '11111111-1111-1111-1111-111111111117', 'Example 2', 1, '{"sentence":"a good   example"}', '"example good a"', 'Duplicate spaces are collapsed before reversing the words.', now()),
('21111111-1111-1111-1111-111111111142', '11111111-1111-1111-1111-111111111117', 'Example 3', 2, '{"sentence":"single"}', '"single"', 'A one-word sentence remains unchanged.', now()),
('21111111-1111-1111-1111-111111111143', '11111111-1111-1111-1111-111111111118', 'Example 2', 1, '{"intervals":[[1,4],[4,5]]}', '[[1,5]]', 'Touching intervals merge because the next start is within the current end.', now()),
('21111111-1111-1111-1111-111111111144', '11111111-1111-1111-1111-111111111118', 'Example 3', 2, '{"intervals":[[1,4],[0,2],[3,5]]}', '[[0,5]]', 'Sorting first reveals that all intervals overlap into one range.', now()),
('21111111-1111-1111-1111-111111111145', '11111111-1111-1111-1111-111111111119', 'Example 2', 1, '{"nums":[1,2,4,5],"target":3}', '-1', 'The target is missing from the sorted array.', now()),
('21111111-1111-1111-1111-111111111146', '11111111-1111-1111-1111-111111111119', 'Example 3', 2, '{"nums":[1,2,2,2,2],"target":2}', '1', 'The first matching index is 1 even though later matches exist.', now()),
('21111111-1111-1111-1111-111111111147', '11111111-1111-1111-1111-111111111120', 'Example 2', 1, '{"n":2}', '2', 'The two ways are 1+1 and 2.', now()),
('21111111-1111-1111-1111-111111111148', '11111111-1111-1111-1111-111111111120', 'Example 3', 2, '{"n":1}', '1', 'There is one way to climb one step.', now()),
('21111111-1111-1111-1111-111111111149', '11111111-1111-1111-1111-111111111121', 'Example 2', 1, '{"nums":[-1,1,0,-3,3]}', '[0,0,9,0,0]', 'Every position except the zero position includes the zero in its product.', now()),
('21111111-1111-1111-1111-111111111150', '11111111-1111-1111-1111-111111111121', 'Example 3', 2, '{"nums":[2,3,4,5]}', '[60,40,30,24]', 'Each value excludes the current index from the total product.', now());

alter table problems
    alter column solution_video_url set not null,
    alter column knowledge_rubric set not null;

create table problem_review_states (
    id uuid primary key,
    problem_id uuid not null references problems(id) on delete cascade,
    track varchar(24) not null,
    status varchar(24) not null,
    due_at timestamp with time zone not null,
    last_reviewed_at timestamp with time zone,
    interval_days integer not null,
    ease_factor double precision not null,
    repetitions integer not null,
    lapses integer not null,
    last_result varchar(24),
    priority_score double precision not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint uk_problem_review_states_problem_track unique (problem_id, track)
);

insert into problem_review_states (
    id, problem_id, track, status, due_at, interval_days, ease_factor, repetitions,
    lapses, priority_score, created_at, updated_at
)
select md5(id::text || ':coding')::uuid,
       id,
       'CODING',
       'NEW',
       now(),
       0,
       2.5,
       0,
       0,
       1.5,
       now(),
       now()
from problems
where type = 'JAVA';

insert into problem_review_states (
    id, problem_id, track, status, due_at, interval_days, ease_factor, repetitions,
    lapses, priority_score, created_at, updated_at
)
select md5(id::text || ':explanation')::uuid,
       id,
       'EXPLANATION',
       'NEW',
       now(),
       0,
       2.5,
       0,
       0,
       2.0,
       now(),
       now()
from problems
where type = 'JAVA';
