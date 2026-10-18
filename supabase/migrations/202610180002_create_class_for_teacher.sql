-- Create a class and its initial membership in one trusted transaction.
-- The function checks the caller and every selected student explicitly.
create or replace function public.create_class_for_teacher(
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
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'teacher'::public.account_role and p.active
  ) then
    raise exception using errcode = '42501', message = 'An active teacher account is required.';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception using errcode = '22023', message = 'Class title is required.';
  end if;

  foreach v_student_id in array coalesce(p_student_ids, '{}'::uuid[]) loop
    if not exists (
      select 1 from public.teacher_students ts
      where ts.teacher_id = v_uid and ts.student_id = v_student_id
    ) then
      raise exception using errcode = '42501', message = 'A selected student is not assigned to this teacher.';
    end if;
  end loop;

  insert into public.classes (teacher_id, title, description, active)
  values (v_uid, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), coalesce(p_active, true))
  returning * into v_class;

  insert into public.class_students (class_id, student_id)
  select v_class.id, selected.student_id
  from (select distinct unnest(coalesce(p_student_ids, '{}'::uuid[])) as student_id) selected;

  return to_jsonb(v_class);
end;
$function$;

revoke all on function public.create_class_for_teacher(text, text, boolean, uuid[]) from public, anon;
grant execute on function public.create_class_for_teacher(text, text, boolean, uuid[]) to authenticated;
