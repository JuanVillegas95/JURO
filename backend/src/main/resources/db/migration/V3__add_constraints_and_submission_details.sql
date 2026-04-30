alter table problems
    add column constraints_markdown text;

alter table submissions
    add column total_runtime_millis bigint,
    add column result_details_json text;

update problems
set constraints_markdown = E'- `2 <= nums.length <= 10^4`\n- `-10^9 <= nums[i] <= 10^9`\n- `-10^9 <= target <= 10^9`\n- Exactly one valid answer exists.'
where id = '11111111-1111-1111-1111-111111111111';

update problems
set constraints_markdown = E'- At least one invoice exists for every returned customer.\n- Return rows sorted by `total_amount` descending.\n- Group by customer name.'
where id = '11111111-1111-1111-1111-111111111112';

update problems
set constraints_markdown = E'- `-2^31 <= x <= 2^31 - 1`\n- Negative numbers are never palindromes.\n- Avoid converting the number to a string for the core solution.'
where id = '11111111-1111-1111-1111-111111111113';

update problems
set constraints_markdown = E'- `1 <= s.length <= 10^4`\n- `s` contains only `()[]{}`.\n- Every closing bracket must match the most recent unclosed opening bracket.'
where id = '11111111-1111-1111-1111-111111111114';

update problems
set constraints_markdown = E'- `1 <= prices.length <= 10^5`\n- `0 <= prices[i] <= 10^4`\n- You may complete at most one buy and one sell.'
where id = '11111111-1111-1111-1111-111111111115';

update problems
set constraints_markdown = E'- `1 <= words.length <= 200`\n- `0 <= words[i].length <= 200`\n- Return an empty string when no common prefix exists.'
where id = '11111111-1111-1111-1111-111111111116';

update problems
set constraints_markdown = E'- `1 <= sentence.length <= 10^4`\n- The sentence contains words separated by spaces.\n- The output must use a single space between words.'
where id = '11111111-1111-1111-1111-111111111117';

update problems
set constraints_markdown = E'- `1 <= intervals.length <= 10^4`\n- `intervals[i].length == 2`\n- `0 <= start <= end <= 10^4`\n- The result must be ordered by interval start.'
where id = '11111111-1111-1111-1111-111111111118';

update problems
set constraints_markdown = E'- `1 <= nums.length <= 10^5`\n- `nums` is sorted in ascending order.\n- Return the first matching index or `-1` when the target is absent.'
where id = '11111111-1111-1111-1111-111111111119';

update problems
set constraints_markdown = E'- `1 <= n <= 45`\n- You can take either 1 or 2 steps at a time.'
where id = '11111111-1111-1111-1111-111111111120';

update problems
set constraints_markdown = E'- `2 <= nums.length <= 10^5`\n- `-30 <= nums[i] <= 30`\n- Prefix and suffix products fit in a 32-bit integer.'
where id = '11111111-1111-1111-1111-111111111121';

update problems
set constraints_markdown = E'- Return one row per `sale_month` and region.\n- Format the month as `YYYY-MM`.\n- Sort by month and then region.'
where id = '11111111-1111-1111-1111-111111111122';

update problems
set constraints_markdown = E'- Return employees with zero project assignments.\n- Sort the result alphabetically by employee name.'
where id = '11111111-1111-1111-1111-111111111123';

update problems
set constraints_markdown = E'- Salaries may repeat.\n- Return exactly one row.\n- If a second distinct salary does not exist, the result should be `null`.'
where id = '11111111-1111-1111-1111-111111111124';

update problems
set constraints_markdown = E'- Order by `txn_date` and then `id`.\n- Include every transaction row.\n- Running balance should accumulate in displayed order.'
where id = '11111111-1111-1111-1111-111111111125';

update problems
set constraints_markdown = E'- Return each duplicated email only once.\n- Sort duplicated emails alphabetically.'
where id = '11111111-1111-1111-1111-111111111126';

update problems
set constraints_markdown = E'- Include departments with zero employees.\n- Sort by `employee_count` descending and then department name.'
where id = '11111111-1111-1111-1111-111111111127';

update problems
set constraints_markdown = E'- Use `2024-01-01` as an inclusive cutoff.\n- Sort by `order_date` and then `order_id`.'
where id = '11111111-1111-1111-1111-111111111128';

update problems
set constraints_markdown = E'- Return only customers with zero orders.\n- Sort the result alphabetically by customer name.'
where id = '11111111-1111-1111-1111-111111111129';

update problems
set constraints_markdown = E'- Return one row per category.\n- Break ties by `product_name` ascending.\n- Sort final rows by category.'
where id = '11111111-1111-1111-1111-111111111130';
