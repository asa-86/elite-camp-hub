-- Keep class creation limited to the signed-in, active teacher. Read the
-- caller's own profile directly so this policy does not depend on the
-- current_role() helper when checking the inserted row.
drop policy if exists classes_teacher_insert on public.classes;

create policy classes_teacher_insert on public.classes
for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'teacher'::public.account_role
      and p.active = true
  )
);
