BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(21);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('00000000-0000-0000-0000-0000000000a1', 'pgtap.a@example.com', '{"name":"Alice"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'pgtap.b@example.com', '{"name":"Bob"}');
CREATE TEMP TABLE fixture AS SELECT owner_id, id AS household_id FROM public.pantry_households
 WHERE owner_id IN ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');
GRANT SELECT ON fixture TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SELECT lives_ok($$INSERT INTO public.pantry_items(household_id,name,created_by)
 SELECT household_id,'  Milk  ',owner_id FROM fixture WHERE owner_id=auth.uid()$$, 'member creates item');
SELECT is((SELECT name FROM public.pantry_items LIMIT 1), 'Milk', 'edge spaces removed before storage');
SELECT throws_ok($$INSERT INTO public.pantry_items(household_id,name,created_by)
 SELECT household_id,'milk',owner_id FROM fixture WHERE owner_id=auth.uid()$$, '23505', NULL, 'case insensitive duplicate blocked');
SELECT throws_ok($$INSERT INTO public.pantry_items(household_id,name,created_by,category,location,status)
 SELECT household_id,' MILK ',owner_id,'grains','counter','out' FROM fixture WHERE owner_id=auth.uid()$$, '23505', NULL, 'other fields do not affect uniqueness');
SELECT lives_ok($$UPDATE public.pantry_items SET name=' Milk ',status='low'$$, 'self edit succeeds');
SELECT lives_ok($$INSERT INTO public.pantry_items(household_id,name,created_by)
 SELECT household_id,'Milk Fridge',owner_id FROM fixture WHERE owner_id=auth.uid()$$, 'distinct name allowed');
SELECT throws_ok($$UPDATE public.pantry_items SET name='milk' WHERE name='Milk Fridge'$$, '23505', NULL, 'duplicate rename blocked');
SELECT throws_ok($$INSERT INTO public.pantry_items(household_id,name,created_by)
 SELECT household_id,'   ',owner_id FROM fixture WHERE owner_id=auth.uid()$$, '23514', NULL, 'blank name blocked');
SELECT throws_ok($$UPDATE public.pantry_items SET category='invalid'$$, '23514', NULL, 'invalid category blocked');
SELECT throws_ok($$UPDATE public.profiles SET is_premium=true WHERE id=auth.uid()$$, '42501', NULL, 'premium escalation blocked');
SELECT lives_ok($$UPDATE public.profiles SET name='Alice',language='de' WHERE id=auth.uid()$$, 'allowed profile fields editable');
SELECT throws_ok($$UPDATE public.pantry_items SET created_by='00000000-0000-0000-0000-0000000000b1'$$, '42501', NULL, 'creator immutable');
SELECT throws_ok($$INSERT INTO public.pantry_items(household_id,name,created_by)
 SELECT household_id,'Forged','00000000-0000-0000-0000-0000000000b1' FROM fixture WHERE owner_id=auth.uid()$$, '42501', NULL, 'creator spoof blocked');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is((SELECT count(*) FROM public.pantry_items), 0::bigint, 'other household inventory invisible');
SELECT is((SELECT count(*) FROM public.profiles), 1::bigint, 'only own profile visible');
SELECT is((SELECT count(*) FROM public.pantry_households), 1::bigint, 'only own household visible');
SELECT is((SELECT count(*) FROM public.pantry_household_members), 1::bigint, 'only own membership visible');
SELECT lives_ok($$INSERT INTO public.pantry_items(household_id,name,created_by)
 SELECT household_id,'Milk',owner_id FROM fixture WHERE owner_id=auth.uid()$$, 'different household may use same name');
SELECT throws_ok($$INSERT INTO public.pantry_items(household_id,name,created_by)
 SELECT household_id,'Foreign',auth.uid() FROM fixture WHERE owner_id<>auth.uid()$$, '42501', NULL, 'foreign household insert blocked');
WITH deleted AS (DELETE FROM public.pantry_items WHERE household_id IN
 (SELECT household_id FROM fixture WHERE owner_id<>auth.uid()) RETURNING id)
 SELECT is((SELECT count(*) FROM deleted), 0::bigint, 'foreign delete touches zero rows');
WITH changed AS (UPDATE public.pantry_items SET status='out' WHERE household_id IN
 (SELECT household_id FROM fixture WHERE owner_id<>auth.uid()) RETURNING id)
 SELECT is((SELECT count(*) FROM changed), 0::bigint, 'foreign update touches zero rows');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
