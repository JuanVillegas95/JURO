delete from problems
where id <> '11111111-1111-1111-1111-111111111111';

update problems
set slug = 'two-sum',
    title = 'Two Sum',
    summary = 'Return the two indexes that add up to the target.',
    updated_at = now()
where id = '11111111-1111-1111-1111-111111111111';
