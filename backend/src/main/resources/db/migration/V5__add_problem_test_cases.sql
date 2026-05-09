create table problem_test_cases (
    id uuid primary key,
    problem_id uuid not null references problems(id) on delete cascade,
    label varchar(120) not null,
    sort_order integer not null,
    input_data text not null,
    expected_output text not null,
    hidden boolean not null,
    explanation text,
    created_at timestamp with time zone not null
);

insert into problem_test_cases (
    id, problem_id, label, sort_order, input_data, expected_output, hidden, explanation, created_at
)
select md5(id::text || ':test-case')::uuid,
       problem_id,
       label,
       sort_order,
       input_data,
       expected_output,
       false,
       explanation,
       created_at
from problem_examples
where problem_id in (select id from problems where type = 'JAVA');
