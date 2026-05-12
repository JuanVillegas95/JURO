create table problems (
    id uuid primary key,
    slug varchar(160) not null unique,
    title varchar(180) not null,
    summary varchar(280) not null,
    description_markdown text not null,
    constraints_markdown text,
    type varchar(20) not null,
    difficulty varchar(20) not null,
    starter_code text,
    reference_solution text,
    evaluation_notes text,
    solution_video_url text,
    knowledge_rubric text not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create table problem_examples (
    id uuid primary key,
    problem_id uuid not null references problems(id) on delete cascade,
    label varchar(120) not null,
    sort_order integer not null,
    input_data text not null,
    expected_output text not null,
    explanation text,
    created_at timestamp with time zone not null
);

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

create table submissions (
    id uuid primary key,
    problem_id uuid not null references problems(id) on delete cascade,
    submitted_language varchar(20) not null,
    source_code text not null,
    status varchar(20) not null,
    result_summary text not null,
    total_runtime_millis bigint,
    result_details_json text,
    created_at timestamp with time zone not null
);

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

insert into problems (
    id, slug, title, summary, description_markdown, constraints_markdown, type, difficulty,
    starter_code, reference_solution, evaluation_notes, solution_video_url, knowledge_rubric,
    created_at, updated_at
) values (
    '11111111-1111-1111-1111-111111111111',
    'two-sum',
    'Two Sum',
    'Return the two indexes that add up to the target.',
    'Given an integer array `nums` and an integer `target`, return the indexes of the two values whose sum equals `target`.',
    '- `2 <= nums.length <= 10^4`
- `-10^9 <= nums[i] <= 10^9`
- `-10^9 <= target <= 10^9`
- Exactly one valid answer exists.',
    'JAVA',
    'EASY',
    'class Solution {
    public int[] solve(int[] nums, int target) {
        return new int[0];
    }
}',
    'class Solution {
    public int[] solve(int[] nums, int target) {
        java.util.Map<Integer, Integer> seen = new java.util.HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                return new int[] { seen.get(complement), i };
            }
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}',
    'A correct Java solution should track previous values and their indexes, then return the complement pair as soon as it is found.',
    'https://www.youtube.com/watch?v=JUROJAVA001',
    'A strong explanation must describe the hash map algorithm, why checking the complement before inserting the current value prevents reusing the same index, important edge cases such as duplicate values and zeroes, and the expected O(n) time and O(n) space complexity.',
    current_timestamp,
    current_timestamp
);

insert into problem_examples (
    id, problem_id, label, sort_order, input_data, expected_output, explanation, created_at
) values
(
    '21111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Example 1',
    0,
    '{"nums":[2,7,11,15],"target":9}',
    '[0,1]',
    'The values at indexes 0 and 1 add up to 9.',
    current_timestamp
),
(
    '21111111-1111-1111-1111-111111111112',
    '11111111-1111-1111-1111-111111111111',
    'Example 2',
    1,
    '{"nums":[3,2,4],"target":6}',
    '[1,2]',
    'The values 2 and 4 match the target.',
    current_timestamp
),
(
    '21111111-1111-1111-1111-111111111132',
    '11111111-1111-1111-1111-111111111111',
    'Example 3',
    2,
    '{"nums":[0,4,3,0],"target":0}',
    '[0,3]',
    'The two zero values at indexes 0 and 3 add up to the target.',
    current_timestamp
);

insert into problem_test_cases (
    id, problem_id, label, sort_order, input_data, expected_output, hidden, explanation, created_at
) values
(
    '31111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Case 1',
    0,
    '{"nums":[2,7,11,15],"target":9}',
    '[0,1]',
    false,
    'Basic complement case.',
    current_timestamp
),
(
    '31111111-1111-1111-1111-111111111112',
    '11111111-1111-1111-1111-111111111111',
    'Case 2',
    1,
    '{"nums":[3,2,4],"target":6}',
    '[1,2]',
    false,
    'The matching pair is not at the front.',
    current_timestamp
),
(
    '31111111-1111-1111-1111-111111111113',
    '11111111-1111-1111-1111-111111111111',
    'Case 3',
    2,
    '{"nums":[0,4,3,0],"target":0}',
    '[0,3]',
    false,
    'Duplicate zero values are valid when they are different indexes.',
    current_timestamp
);

insert into problem_review_states (
    id, problem_id, track, status, due_at, interval_days, ease_factor, repetitions,
    lapses, priority_score, created_at, updated_at
) values
(
    '41111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'CODING',
    'NEW',
    current_timestamp,
    0,
    2.5,
    0,
    0,
    1.5,
    current_timestamp,
    current_timestamp
),
(
    '41111111-1111-1111-1111-111111111112',
    '11111111-1111-1111-1111-111111111111',
    'EXPLANATION',
    'NEW',
    current_timestamp,
    0,
    2.5,
    0,
    0,
    2.0,
    current_timestamp,
    current_timestamp
);
