-- Class ownership and membership are now assigned by administrators.
drop policy if exists classes_teacher_insert on public.classes;
drop policy if exists classes_admin_insert on public.classes;
create policy classes_admin_insert on public.classes
for insert to authenticated
with check (public.is_admin());

-- Retire the previous teacher-owned class creation RPC. Teachers keep the
-- existing update, class membership, session, and attendance policies.
revoke all on function public.create_class_for_teacher(text, text, boolean, uuid[]) from public, anon, authenticated;

create or replace function public.admin_create_class(
  p_teacher_id uuid,
  p_title text,
  p_description text,
  p_active boolean,
  p_student_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid;
  v_class public.classes%rowtype;
  v_student_id uuid;
begin
  v_uid := coalesce(auth.uid(), nullif(auth.jwt() ->> 'sub', '')::uuid);
  if v_uid is null or not coalesce(public.is_admin(), false) then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_teacher_id and p.role = 'teacher'::public.account_role and p.active
  ) then
    raise exception using errcode = '22023', message = 'An active teacher must be selected.';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception using errcode = '22023', message = 'Class title is required.';
  end if;

  foreach v_student_id in array coalesce(p_student_ids, '{}'::uuid[]) loop
    if not exists (
      select 1 from public.profiles p
      where p.id = v_student_id and p.role = 'student'::public.account_role and p.active
    ) then
      raise exception using errcode = '22023', message = 'A selected student is invalid or inactive.';
    end if;

    insert into public.teacher_students (teacher_id, student_id)
    values (p_teacher_id, v_student_id)
    on conflict (teacher_id, student_id) do nothing;
  end loop;

  insert into public.classes (teacher_id, title, description, active)
  values (p_teacher_id, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), coalesce(p_active, true))
  returning * into v_class;

  insert into public.class_students (class_id, student_id)
  select v_class.id, selected.student_id
  from (select distinct unnest(coalesce(p_student_ids, '{}'::uuid[])) as student_id) selected;

  return to_jsonb(v_class);
end;
$function$;

revoke all on function public.admin_create_class(uuid, text, text, boolean, uuid[]) from public, anon;
grant execute on function public.admin_create_class(uuid, text, text, boolean, uuid[]) to authenticated;
