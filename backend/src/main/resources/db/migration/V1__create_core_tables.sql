create table problems (
    id uuid primary key,
    slug varchar(160) not null unique,
    title varchar(180) not null,
    summary varchar(280) not null,
    description_markdown text not null,
    type varchar(20) not null,
    difficulty varchar(20) not null,
    starter_code text,
    reference_solution text,
    evaluation_notes text,
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

create table submissions (
    id uuid primary key,
    problem_id uuid not null references problems(id) on delete cascade,
    submitted_language varchar(20) not null,
    source_code text not null,
    status varchar(20) not null,
    result_summary text not null,
    created_at timestamp with time zone not null
);

insert into problems (
    id, slug, title, summary, description_markdown, type, difficulty,
    starter_code, reference_solution, evaluation_notes, created_at, updated_at
) values (
    '11111111-1111-1111-1111-111111111111',
    'two-sum-lite',
    'Two Sum Lite',
    'Return the two indexes that add up to the target.',
    'Given an integer array `nums` and an integer `target`, return the indexes of the two values whose sum equals `target`.',
    'JAVA',
    'EASY',
    'class Solution {\n    public int[] solve(int[] nums, int target) {\n        return new int[0];\n    }\n}',
    'class Solution {\n    public int[] solve(int[] nums, int target) {\n        java.util.Map<Integer, Integer> seen = new java.util.HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int complement = target - nums[i];\n            if (seen.containsKey(complement)) {\n                return new int[] { seen.get(complement), i };\n            }\n            seen.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}',
    'Examples are stored as JSON-shaped input/output for a future Java judge.',
    now(),
    now()
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
    now()
),
(
    '21111111-1111-1111-1111-111111111112',
    '11111111-1111-1111-1111-111111111111',
    'Example 2',
    1,
    '{"nums":[3,2,4],"target":6}',
    '[1,2]',
    'The values 2 and 4 match the target.',
    now()
);

insert into problems (
    id, slug, title, summary, description_markdown, type, difficulty,
    starter_code, reference_solution, evaluation_notes, created_at, updated_at
) values (
    '11111111-1111-1111-1111-111111111112',
    'top-customers',
    'Top Customers',
    'Return customers ordered by total invoice amount.',
    'Write a SQL query that returns the customer name and total invoice amount, ordered from highest to lowest total.',
    'SQL',
    'MEDIUM',
    'select c.name, sum(i.amount) as total_amount\nfrom customers c\njoin invoices i on i.customer_id = c.id\ngroup by c.name\norder by total_amount desc;',
    'select c.name, sum(i.amount) as total_amount\nfrom customers c\njoin invoices i on i.customer_id = c.id\ngroup by c.name\norder by total_amount desc;',
    'For SQL problems, use example input as setup DDL/DML and expected output as the target result set.',
    now(),
    now()
);

insert into problem_examples (
    id, problem_id, label, sort_order, input_data, expected_output, explanation, created_at
) values (
    '21111111-1111-1111-1111-111111111113',
    '11111111-1111-1111-1111-111111111112',
    'Example 1',
    0,
    'create table customers (id integer primary key, name varchar(60));\ncreate table invoices (id integer primary key, customer_id integer not null, amount numeric(10,2) not null);\ninsert into customers (id, name) values (1, ''Ana''), (2, ''Luis'');\ninsert into invoices (id, customer_id, amount) values (1, 1, 80.00), (2, 1, 20.00), (3, 2, 50.00);',
    '[{"name":"Ana","total_amount":100.00},{"name":"Luis","total_amount":50.00}]',
    'The expected rows show total invoice amount per customer.',
    now()
);
