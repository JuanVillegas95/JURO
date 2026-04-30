update problems
set starter_code = E'class Solution {\n    public int[] solve(int[] nums, int target) {\n        return new int[0];\n    }\n}',
    reference_solution = E'class Solution {\n    public int[] solve(int[] nums, int target) {\n        java.util.Map<Integer, Integer> seen = new java.util.HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int complement = target - nums[i];\n            if (seen.containsKey(complement)) {\n                return new int[] { seen.get(complement), i };\n            }\n            seen.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}'
where id = '11111111-1111-1111-1111-111111111111';

update problems
set starter_code = E'select c.name, sum(i.amount) as total_amount\nfrom customers c\njoin invoices i on i.customer_id = c.id\ngroup by c.name\norder by total_amount desc;',
    reference_solution = E'select c.name, sum(i.amount) as total_amount\nfrom customers c\njoin invoices i on i.customer_id = c.id\ngroup by c.name\norder by total_amount desc;'
where id = '11111111-1111-1111-1111-111111111112';

update problem_examples
set input_data = E'create table customers (id integer primary key, name varchar(60));\ncreate table invoices (id integer primary key, customer_id integer not null, amount numeric(10,2) not null);\ninsert into customers (id, name) values (1, ''Ana''), (2, ''Luis'');\ninsert into invoices (id, customer_id, amount) values (1, 1, 80.00), (2, 1, 20.00), (3, 2, 50.00);'
where id = '21111111-1111-1111-1111-111111111113';

insert into problems (
    id, slug, title, summary, description_markdown, type, difficulty,
    starter_code, reference_solution, evaluation_notes, created_at, updated_at
) values
(
    '11111111-1111-1111-1111-111111111113',
    'palindrome-number',
    'Palindrome Number',
    'Return true when the integer reads the same forward and backward.',
    'Given an integer `x`, return `true` if the value is a palindrome and `false` otherwise. Negative numbers are never palindromes.',
    'JAVA',
    'EASY',
    E'class Solution {\n    public boolean solve(int x) {\n        return false;\n    }\n}',
    E'class Solution {\n    public boolean solve(int x) {\n        if (x < 0 || (x % 10 == 0 && x != 0)) {\n            return false;\n        }\n\n        int reversedHalf = 0;\n        while (x > reversedHalf) {\n            reversedHalf = reversedHalf * 10 + x % 10;\n            x /= 10;\n        }\n\n        return x == reversedHalf || x == reversedHalf / 10;\n    }\n}',
    'Examples are stored as JSON-shaped input/output for a future Java judge.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111114',
    'valid-parentheses-mini',
    'Valid Parentheses Mini',
    'Check whether the bracket sequence is balanced.',
    'Given a string `s` containing only the characters `()[]{}`, return `true` when every opening bracket is closed in the correct order.',
    'JAVA',
    'EASY',
    E'class Solution {\n    public boolean solve(String s) {\n        return false;\n    }\n}',
    E'class Solution {\n    public boolean solve(String s) {\n        java.util.Deque<Character> stack = new java.util.ArrayDeque<>();\n        for (char current : s.toCharArray()) {\n            if (current == ''('' || current == ''['' || current == ''{'') {\n                stack.push(current);\n                continue;\n            }\n\n            if (stack.isEmpty()) {\n                return false;\n            }\n\n            char opening = stack.pop();\n            if ((current == '')'' && opening != ''('')\n                    || (current == '']'' && opening != ''['')\n                    || (current == ''}'' && opening != ''{'')) {\n                return false;\n            }\n        }\n        return stack.isEmpty();\n    }\n}',
    'Examples are stored as JSON-shaped input/output for a future Java judge.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111115',
    'best-profit-once',
    'Best Profit Once',
    'Return the best profit from a single buy and single sell.',
    'You are given an array `prices` where `prices[i]` is the price of a stock on day `i`. Return the maximum profit you can achieve by buying once and selling once later.',
    'JAVA',
    'EASY',
    E'class Solution {\n    public int solve(int[] prices) {\n        return 0;\n    }\n}',
    E'class Solution {\n    public int solve(int[] prices) {\n        int minimum = Integer.MAX_VALUE;\n        int best = 0;\n        for (int price : prices) {\n            minimum = Math.min(minimum, price);\n            best = Math.max(best, price - minimum);\n        }\n        return best;\n    }\n}',
    'Examples are stored as JSON-shaped input/output for a future Java judge.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111116',
    'longest-common-prefix',
    'Longest Common Prefix',
    'Return the shared prefix across all words.',
    'Given an array of strings `words`, return the longest common prefix. If there is no common prefix, return an empty string.',
    'JAVA',
    'EASY',
    E'class Solution {\n    public String solve(String[] words) {\n        return "";\n    }\n}',
    E'class Solution {\n    public String solve(String[] words) {\n        if (words.length == 0) {\n            return "";\n        }\n\n        String prefix = words[0];\n        for (int i = 1; i < words.length; i++) {\n            while (!words[i].startsWith(prefix)) {\n                prefix = prefix.substring(0, prefix.length() - 1);\n                if (prefix.isEmpty()) {\n                    return "";\n                }\n            }\n        }\n        return prefix;\n    }\n}',
    'Examples are stored as JSON-shaped input/output for a future Java judge.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111117',
    'reverse-words-clean',
    'Reverse Words Clean',
    'Trim duplicate spaces and return the words in reverse order.',
    'Given a sentence, remove leading, trailing, and repeated spaces, then return the words in reverse order separated by a single space.',
    'JAVA',
    'EASY',
    E'class Solution {\n    public String solve(String sentence) {\n        return "";\n    }\n}',
    E'class Solution {\n    public String solve(String sentence) {\n        String[] parts = sentence.trim().split("\\\\s+");\n        StringBuilder builder = new StringBuilder();\n        for (int i = parts.length - 1; i >= 0; i--) {\n            builder.append(parts[i]);\n            if (i > 0) {\n                builder.append('' '');\n            }\n        }\n        return builder.toString();\n    }\n}',
    'Examples are stored as JSON-shaped input/output for a future Java judge.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111118',
    'merge-intervals-lite',
    'Merge Intervals Lite',
    'Combine overlapping intervals and keep non-overlapping ones untouched.',
    'Given a list of intervals, merge every overlapping pair and return the reduced list ordered by start position.',
    'JAVA',
    'MEDIUM',
    E'class Solution {\n    public int[][] solve(int[][] intervals) {\n        return new int[0][0];\n    }\n}',
    E'class Solution {\n    public int[][] solve(int[][] intervals) {\n        java.util.Arrays.sort(intervals, java.util.Comparator.comparingInt(a -> a[0]));\n        java.util.List<int[]> merged = new java.util.ArrayList<>();\n        int[] current = intervals[0].clone();\n\n        for (int i = 1; i < intervals.length; i++) {\n            if (intervals[i][0] <= current[1]) {\n                current[1] = Math.max(current[1], intervals[i][1]);\n            } else {\n                merged.add(current);\n                current = intervals[i].clone();\n            }\n        }\n\n        merged.add(current);\n        return merged.toArray(new int[0][]);\n    }\n}',
    'Examples are stored as JSON-shaped input/output for a future Java judge.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111119',
    'binary-search-first-hit',
    'Binary Search First Hit',
    'Find the first occurrence of the target in a sorted array.',
    'Given a sorted array `nums` and a `target`, return the index of the first occurrence of the target. Return `-1` if the target does not exist.',
    'JAVA',
    'MEDIUM',
    E'class Solution {\n    public int solve(int[] nums, int target) {\n        return -1;\n    }\n}',
    E'class Solution {\n    public int solve(int[] nums, int target) {\n        int left = 0;\n        int right = nums.length - 1;\n        int answer = -1;\n\n        while (left <= right) {\n            int middle = left + (right - left) / 2;\n            if (nums[middle] >= target) {\n                right = middle - 1;\n            } else {\n                left = middle + 1;\n            }\n\n            if (nums[middle] == target) {\n                answer = middle;\n            }\n        }\n\n        return answer;\n    }\n}',
    'Examples are stored as JSON-shaped input/output for a future Java judge.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111120',
    'climb-stairs-count',
    'Climb Stairs Count',
    'Count how many distinct ways exist to reach the top.',
    'You can climb either 1 or 2 steps at a time. Given `n`, return the number of distinct ways to reach exactly step `n`.',
    'JAVA',
    'EASY',
    E'class Solution {\n    public int solve(int n) {\n        return 0;\n    }\n}',
    E'class Solution {\n    public int solve(int n) {\n        if (n <= 2) {\n            return n;\n        }\n\n        int previous = 1;\n        int current = 2;\n        for (int step = 3; step <= n; step++) {\n            int next = previous + current;\n            previous = current;\n            current = next;\n        }\n        return current;\n    }\n}',
    'Examples are stored as JSON-shaped input/output for a future Java judge.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111121',
    'product-except-self-lite',
    'Product Except Self Lite',
    'Return the product of all values except the current position.',
    'Given an integer array `nums`, return a new array where each value at index `i` contains the product of every number except `nums[i]`.',
    'JAVA',
    'MEDIUM',
    E'class Solution {\n    public int[] solve(int[] nums) {\n        return new int[0];\n    }\n}',
    E'class Solution {\n    public int[] solve(int[] nums) {\n        int[] result = new int[nums.length];\n        int prefix = 1;\n        for (int i = 0; i < nums.length; i++) {\n            result[i] = prefix;\n            prefix *= nums[i];\n        }\n\n        int suffix = 1;\n        for (int i = nums.length - 1; i >= 0; i--) {\n            result[i] *= suffix;\n            suffix *= nums[i];\n        }\n        return result;\n    }\n}',
    'Examples are stored as JSON-shaped input/output for a future Java judge.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111122',
    'monthly-revenue-by-region',
    'Monthly Revenue By Region',
    'Return monthly revenue totals per region.',
    'Write a query that returns the month, region name, and total revenue. Order the result by month and region.',
    'SQL',
    'MEDIUM',
    E'select to_char(sale_date, ''YYYY-MM'') as sale_month,\n       region,\n       sum(amount) as total_amount\nfrom sales\njoin regions on regions.id = sales.region_id\ngroup by to_char(sale_date, ''YYYY-MM''), region\norder by sale_month, region;',
    E'select to_char(sale_date, ''YYYY-MM'') as sale_month,\n       region,\n       sum(amount) as total_amount\nfrom sales\njoin regions on regions.id = sales.region_id\ngroup by to_char(sale_date, ''YYYY-MM''), region\norder by sale_month, region;',
    'For SQL problems, use example input as setup DDL/DML and expected output as the target result set.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111123',
    'employees-without-projects',
    'Employees Without Projects',
    'Return employees that do not appear in any project assignment.',
    'Write a query that returns each employee name that has no matching row in the `project_assignments` table.',
    'SQL',
    'EASY',
    E'select e.name\nfrom employees e\nleft join project_assignments p on p.employee_id = e.id\nwhere p.employee_id is null\norder by e.name;',
    E'select e.name\nfrom employees e\nleft join project_assignments p on p.employee_id = e.id\nwhere p.employee_id is null\norder by e.name;',
    'For SQL problems, use example input as setup DDL/DML and expected output as the target result set.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111124',
    'second-highest-salary-lite',
    'Second Highest Salary Lite',
    'Return the second distinct highest salary.',
    'Write a query that returns the second distinct highest salary from the `employees` table. If it does not exist, return `null`.',
    'SQL',
    'MEDIUM',
    E'select max(salary) as second_highest_salary\nfrom employees\nwhere salary < (select max(salary) from employees);',
    E'select max(salary) as second_highest_salary\nfrom employees\nwhere salary < (select max(salary) from employees);',
    'For SQL problems, use example input as setup DDL/DML and expected output as the target result set.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111125',
    'running-balance',
    'Running Balance',
    'Return each transaction with the account running balance.',
    'Write a query that returns the transaction date, amount, and running balance ordered by transaction date.',
    'SQL',
    'MEDIUM',
    E'select txn_date,\n       amount,\n       sum(amount) over (order by txn_date, id) as running_balance\nfrom transactions\norder by txn_date, id;',
    E'select txn_date,\n       amount,\n       sum(amount) over (order by txn_date, id) as running_balance\nfrom transactions\norder by txn_date, id;',
    'For SQL problems, use example input as setup DDL/DML and expected output as the target result set.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111126',
    'duplicate-emails',
    'Duplicate Emails',
    'Return every email address that appears more than once.',
    'Write a query that returns the duplicated email addresses from the `people` table ordered alphabetically.',
    'SQL',
    'EASY',
    E'select email\nfrom people\ngroup by email\nhaving count(*) > 1\norder by email;',
    E'select email\nfrom people\ngroup by email\nhaving count(*) > 1\norder by email;',
    'For SQL problems, use example input as setup DDL/DML and expected output as the target result set.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111127',
    'department-headcount',
    'Department Headcount',
    'Return each department with its employee count.',
    'Write a query that returns the department name and number of employees, ordered by employee count descending and then department name.',
    'SQL',
    'EASY',
    E'select d.name as department_name,\n       count(e.id) as employee_count\nfrom departments d\nleft join employees e on e.department_id = d.id\ngroup by d.name\norder by employee_count desc, department_name;',
    E'select d.name as department_name,\n       count(e.id) as employee_count\nfrom departments d\nleft join employees e on e.department_id = d.id\ngroup by d.name\norder by employee_count desc, department_name;',
    'For SQL problems, use example input as setup DDL/DML and expected output as the target result set.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111128',
    'recent-orders',
    'Recent Orders',
    'Return orders placed on or after a cutoff date.',
    'Write a query that returns the order id, customer name, and order date for every order placed on or after `2024-01-01`.',
    'SQL',
    'EASY',
    E'select o.id as order_id,\n       c.name as customer_name,\n       o.order_date\nfrom orders o\njoin customers c on c.id = o.customer_id\nwhere o.order_date >= date ''2024-01-01''\norder by o.order_date, order_id;',
    E'select o.id as order_id,\n       c.name as customer_name,\n       o.order_date\nfrom orders o\njoin customers c on c.id = o.customer_id\nwhere o.order_date >= date ''2024-01-01''\norder by o.order_date, order_id;',
    'For SQL problems, use example input as setup DDL/DML and expected output as the target result set.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111129',
    'inactive-customers',
    'Inactive Customers',
    'Return customers that never placed an order.',
    'Write a query that returns the name of every customer without any matching order row.',
    'SQL',
    'EASY',
    E'select c.name\nfrom customers c\nleft join orders o on o.customer_id = c.id\nwhere o.customer_id is null\norder by c.name;',
    E'select c.name\nfrom customers c\nleft join orders o on o.customer_id = c.id\nwhere o.customer_id is null\norder by c.name;',
    'For SQL problems, use example input as setup DDL/DML and expected output as the target result set.',
    now(),
    now()
),
(
    '11111111-1111-1111-1111-111111111130',
    'top-product-by-category',
    'Top Product By Category',
    'Return the highest selling product inside each category.',
    'Write a query that returns one row per category containing the product with the highest total sold quantity. Break ties by product name.',
    'SQL',
    'HARD',
    E'with product_totals as (\n    select p.category,\n           p.name as product_name,\n           sum(s.quantity) as total_quantity,\n           row_number() over (\n               partition by p.category\n               order by sum(s.quantity) desc, p.name\n           ) as rn\n    from products p\n    join sales s on s.product_id = p.id\n    group by p.category, p.name\n)\nselect category, product_name, total_quantity\nfrom product_totals\nwhere rn = 1\norder by category;',
    E'with product_totals as (\n    select p.category,\n           p.name as product_name,\n           sum(s.quantity) as total_quantity,\n           row_number() over (\n               partition by p.category\n               order by sum(s.quantity) desc, p.name\n           ) as rn\n    from products p\n    join sales s on s.product_id = p.id\n    group by p.category, p.name\n)\nselect category, product_name, total_quantity\nfrom product_totals\nwhere rn = 1\norder by category;',
    'For SQL problems, use example input as setup DDL/DML and expected output as the target result set.',
    now(),
    now()
);

insert into problem_examples (
    id, problem_id, label, sort_order, input_data, expected_output, explanation, created_at
) values
(
    '21111111-1111-1111-1111-111111111114',
    '11111111-1111-1111-1111-111111111113',
    'Example 1',
    0,
    '{"x":121}',
    'true',
    '121 reads the same from left to right and right to left.',
    now()
),
(
    '21111111-1111-1111-1111-111111111115',
    '11111111-1111-1111-1111-111111111114',
    'Example 1',
    0,
    '{"s":"()[]{}"}',
    'true',
    'Every opening bracket is closed in the correct order.',
    now()
),
(
    '21111111-1111-1111-1111-111111111116',
    '11111111-1111-1111-1111-111111111115',
    'Example 1',
    0,
    '{"prices":[7,1,5,3,6,4]}',
    '5',
    'Buy at 1 and sell at 6 to obtain the best profit of 5.',
    now()
),
(
    '21111111-1111-1111-1111-111111111117',
    '11111111-1111-1111-1111-111111111116',
    'Example 1',
    0,
    '{"words":["flower","flow","flight"]}',
    '"fl"',
    'Only `fl` appears at the start of every word.',
    now()
),
(
    '21111111-1111-1111-1111-111111111118',
    '11111111-1111-1111-1111-111111111117',
    'Example 1',
    0,
    '{"sentence":"  hello   world  from  juro "}',
    '"juro from world hello"',
    'Trim the spaces, then reverse the word order.',
    now()
),
(
    '21111111-1111-1111-1111-111111111119',
    '11111111-1111-1111-1111-111111111118',
    'Example 1',
    0,
    '{"intervals":[[1,3],[2,6],[8,10],[15,18]]}',
    '[[1,6],[8,10],[15,18]]',
    'The first two intervals overlap and become `[1,6]`.',
    now()
),
(
    '21111111-1111-1111-1111-111111111120',
    '11111111-1111-1111-1111-111111111119',
    'Example 1',
    0,
    '{"nums":[1,2,2,2,4,5],"target":2}',
    '1',
    'The first `2` appears at index 1.',
    now()
),
(
    '21111111-1111-1111-1111-111111111121',
    '11111111-1111-1111-1111-111111111120',
    'Example 1',
    0,
    '{"n":5}',
    '8',
    'There are eight distinct ways to climb five steps with 1-step and 2-step moves.',
    now()
),
(
    '21111111-1111-1111-1111-111111111122',
    '11111111-1111-1111-1111-111111111121',
    'Example 1',
    0,
    '{"nums":[1,2,3,4]}',
    '[24,12,8,6]',
    'Each position contains the product of every other value.',
    now()
),
(
    '21111111-1111-1111-1111-111111111123',
    '11111111-1111-1111-1111-111111111122',
    'Example 1',
    0,
    E'create table regions (id integer primary key, region varchar(40));\ncreate table sales (id integer primary key, region_id integer not null, sale_date date not null, amount numeric(10,2) not null);\ninsert into regions (id, region) values (1, ''North''), (2, ''South'');\ninsert into sales (id, region_id, sale_date, amount) values\n    (1, 1, date ''2024-01-05'', 100.00),\n    (2, 1, date ''2024-01-20'', 50.00),\n    (3, 2, date ''2024-01-25'', 80.00),\n    (4, 2, date ''2024-02-02'', 40.00);',
    '[{"sale_month":"2024-01","region":"North","total_amount":150.00},{"sale_month":"2024-01","region":"South","total_amount":80.00},{"sale_month":"2024-02","region":"South","total_amount":40.00}]',
    'Aggregate sales by month and region.',
    now()
),
(
    '21111111-1111-1111-1111-111111111124',
    '11111111-1111-1111-1111-111111111123',
    'Example 1',
    0,
    E'create table employees (id integer primary key, name varchar(40));\ncreate table project_assignments (employee_id integer not null, project_name varchar(40) not null);\ninsert into employees (id, name) values (1, ''Ana''), (2, ''Luis''), (3, ''Mia'');\ninsert into project_assignments (employee_id, project_name) values (1, ''Phoenix''), (3, ''Atlas'');',
    '[{"name":"Luis"}]',
    'Luis is the only employee without a matching assignment row.',
    now()
),
(
    '21111111-1111-1111-1111-111111111125',
    '11111111-1111-1111-1111-111111111124',
    'Example 1',
    0,
    E'create table employees (id integer primary key, name varchar(40), salary integer not null);\ninsert into employees (id, name, salary) values (1, ''Ana'', 7000), (2, ''Luis'', 6000), (3, ''Mia'', 7000), (4, ''Noah'', 4500);',
    '[{"second_highest_salary":6000}]',
    '7000 is the highest distinct salary, so 6000 is the second highest.',
    now()
),
(
    '21111111-1111-1111-1111-111111111126',
    '11111111-1111-1111-1111-111111111125',
    'Example 1',
    0,
    E'create table transactions (id integer primary key, txn_date date not null, amount integer not null);\ninsert into transactions (id, txn_date, amount) values\n    (1, date ''2024-01-01'', 100),\n    (2, date ''2024-01-03'', -20),\n    (3, date ''2024-01-05'', 70);',
    '[{"txn_date":"2024-01-01","amount":100,"running_balance":100},{"txn_date":"2024-01-03","amount":-20,"running_balance":80},{"txn_date":"2024-01-05","amount":70,"running_balance":150}]',
    'Use a window function ordered by the transaction date.',
    now()
),
(
    '21111111-1111-1111-1111-111111111127',
    '11111111-1111-1111-1111-111111111126',
    'Example 1',
    0,
    E'create table people (id integer primary key, email varchar(80) not null);\ninsert into people (id, email) values\n    (1, ''ana@example.com''),\n    (2, ''mia@example.com''),\n    (3, ''ana@example.com''),\n    (4, ''mia@example.com''),\n    (5, ''leo@example.com'');',
    '[{"email":"ana@example.com"},{"email":"mia@example.com"}]',
    'Only emails appearing more than once should be returned.',
    now()
),
(
    '21111111-1111-1111-1111-111111111128',
    '11111111-1111-1111-1111-111111111127',
    'Example 1',
    0,
    E'create table departments (id integer primary key, name varchar(40) not null);\ncreate table employees (id integer primary key, name varchar(40), department_id integer references departments(id));\ninsert into departments (id, name) values (1, ''Engineering''), (2, ''Finance''), (3, ''Support'');\ninsert into employees (id, name, department_id) values (1, ''Ana'', 1), (2, ''Luis'', 1), (3, ''Mia'', 2);',
    '[{"department_name":"Engineering","employee_count":2},{"department_name":"Finance","employee_count":1},{"department_name":"Support","employee_count":0}]',
    'Departments without employees should still appear.',
    now()
),
(
    '21111111-1111-1111-1111-111111111129',
    '11111111-1111-1111-1111-111111111128',
    'Example 1',
    0,
    E'create table customers (id integer primary key, name varchar(40) not null);\ncreate table orders (id integer primary key, customer_id integer not null, order_date date not null);\ninsert into customers (id, name) values (1, ''Ana''), (2, ''Luis'');\ninsert into orders (id, customer_id, order_date) values\n    (101, 1, date ''2023-12-29''),\n    (102, 1, date ''2024-01-03''),\n    (103, 2, date ''2024-02-01'');',
    '[{"order_id":102,"customer_name":"Ana","order_date":"2024-01-03"},{"order_id":103,"customer_name":"Luis","order_date":"2024-02-01"}]',
    'Only orders on or after 2024-01-01 qualify.',
    now()
),
(
    '21111111-1111-1111-1111-111111111130',
    '11111111-1111-1111-1111-111111111129',
    'Example 1',
    0,
    E'create table customers (id integer primary key, name varchar(40) not null);\ncreate table orders (id integer primary key, customer_id integer not null);\ninsert into customers (id, name) values (1, ''Ana''), (2, ''Luis''), (3, ''Mia'');\ninsert into orders (id, customer_id) values (101, 1), (102, 1), (103, 3);',
    '[{"name":"Luis"}]',
    'Luis does not appear in the orders table.',
    now()
),
(
    '21111111-1111-1111-1111-111111111131',
    '11111111-1111-1111-1111-111111111130',
    'Example 1',
    0,
    E'create table products (id integer primary key, name varchar(40), category varchar(40));\ncreate table sales (id integer primary key, product_id integer not null, quantity integer not null);\ninsert into products (id, name, category) values\n    (1, ''Keyboard'', ''Peripherals''),\n    (2, ''Mouse'', ''Peripherals''),\n    (3, ''Desk Lamp'', ''Office''),\n    (4, ''Notebook'', ''Office'');\ninsert into sales (id, product_id, quantity) values\n    (1, 1, 10),\n    (2, 1, 6),\n    (3, 2, 11),\n    (4, 3, 9),\n    (5, 4, 9);',
    '[{"category":"Office","product_name":"Desk Lamp","total_quantity":9},{"category":"Peripherals","product_name":"Keyboard","total_quantity":16}]',
    'Use total sold quantity per product, then keep the best row per category.',
    now()
);
