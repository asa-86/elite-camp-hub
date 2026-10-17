-- Core schema for Student Elite Camp.
-- Apply only to a configured Supabase project. Accounts are provisioned by a
-- trusted server function; the browser must never receive the service role key.

create extension if not exists pgcrypto with schema extensions;

create type public.account_role as enum ('admin', 'teacher', 'student');
create type public.attendance_status as enum ('present', 'absent', 'excused');
create type public.assessment_status as enum ('draft', 'published');
create type public.assessment_target as enum ('all_active_students', 'selected_students', 'grades');
create type public.attempt_status as enum ('in_progress', 'submitted', 'expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(trim(username)) and username ~ '^[a-z0-9._]{3,32}$'),
  full_name text not null check (length(trim(full_name)) > 0),
  role public.account_role not null,
  grade smallint check (grade in (7, 8, 9)),
  student_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_grade_role check ((role = 'student' and grade is not null) or (role <> 'student' and grade is null))
);
create index profiles_role_active_idx on public.profiles(role, active);
create index profiles_name_idx on public.profiles using btree(full_name);

create table public.teacher_students (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, student_id),
  check (teacher_id <> student_id)
);
create index teacher_students_student_idx on public.teacher_students(student_id, teacher_id);

create function public.enforce_teacher_student_roles()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.teacher_id and p.role = 'teacher')
    or not exists (select 1 from public.profiles p where p.id = new.student_id and p.role = 'student') then
    raise exception 'teacher/student relationship has invalid account roles';
  end if;
  return new;
end;
$$;
create trigger teacher_student_role_guard before insert or update on public.teacher_students
for each row execute function public.enforce_teacher_student_roles();

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index classes_teacher_created_idx on public.classes(teacher_id, created_at desc);

create table public.class_students (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index class_students_student_idx on public.class_students(student_id, class_id);

-- Enforce the administrator's teacher/student assignment when a teacher adds
-- members. This check is repeated in RLS and is not trusted to client code.
create function public.enforce_class_student_assignment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.classes c
    join public.teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = new.student_id
    where c.id = new.class_id
  ) then
    raise exception 'student is not assigned to this teacher';
  end if;
  return new;
end;
$$;
create trigger class_student_assignment_guard before insert or update on public.class_students
for each row execute function public.enforce_class_student_assignment();

create function public.revoke_class_membership_after_unassignment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  delete from public.class_students cs using public.classes c
  where c.id = cs.class_id and c.teacher_id = old.teacher_id and cs.student_id = old.student_id;
  return old;
end;
$$;
create trigger teacher_student_unassignment_cleanup after delete on public.teacher_students
for each row execute function public.revoke_class_membership_after_unassignment();

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  session_date date not null,
  title text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_class_date_idx on public.sessions(class_id, session_date);

create table public.session_files (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  storage_key text not null unique,
  original_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  created_at timestamptz not null default now()
);

create table public.attendance (
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.attendance_status not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (session_id, student_id)
);
create index attendance_student_updated_idx on public.attendance(student_id, updated_at desc);

create table public.attendance_audit (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  student_id uuid not null,
  old_status public.attendance_status,
  new_status public.attendance_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index attendance_audit_student_idx on public.attendance_audit(student_id, changed_at desc);

create function public.audit_attendance_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.attendance_audit(session_id, student_id, old_status, new_status, changed_by)
    values (new.session_id, new.student_id, case when tg_op = 'INSERT' then null else old.status end,
      new.status, auth.uid());
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger attendance_audit_trigger before insert or update on public.attendance
for each row execute function public.audit_attendance_change();

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  category text,
  storage_key text not null unique,
  original_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  published boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index materials_published_created_idx on public.materials(published, created_at desc);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  instructions text,
  status public.assessment_status not null default 'draft',
  active boolean not null default false,
  target public.assessment_target not null default 'all_active_students',
  target_grades smallint[] not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes smallint check (duration_minutes is null or duration_minutes > 0),
  max_attempts smallint not null default 1 check (max_attempts > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (target <> 'grades' or cardinality(target_grades) > 0)
);
create index assessments_availability_idx on public.assessments(status, active, starts_at, ends_at);

create table public.assessment_assignments (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  primary key (assessment_id, student_id)
);
create index assessment_assignments_student_idx on public.assessment_assignments(student_id, assessment_id);

create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  position integer not null check (position > 0),
  question_type text not null default 'single_choice' check (question_type in ('single_choice')),
  body text not null check (length(trim(body)) > 0),
  unique (assessment_id, position)
);
create table public.assessment_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  position integer not null check (position > 0),
  body text not null check (length(trim(body)) > 0),
  unique (question_id, position)
);
-- Scoring keys are separated so a participant cannot read them before or after
-- submitting. Evaluation should run in a trusted server/Edge Function.
create table public.assessment_option_scores (
  option_id uuid primary key references public.assessment_options(id) on delete cascade,
  score numeric not null default 0
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (id, assessment_id, student_id)
);
create index assessment_attempts_student_idx on public.assessment_attempts(student_id, assessment_id, started_at desc);
create table public.assessment_answers (
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id) on delete restrict,
  option_id uuid not null references public.assessment_options(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
create table public.assessment_results (
  attempt_id uuid primary key references public.assessment_attempts(id) on delete cascade,
  score numeric not null,
  max_score numeric not null,
  calculated_at timestamptz not null default now()
);

create function public.current_role()
returns public.account_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and active = true $$;
create function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role() = 'admin', false) $$;
create function public.can_access_class(class_uuid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin()
    or exists (select 1 from public.classes c where c.id = class_uuid and c.teacher_id = auth.uid())
    or exists (select 1 from public.class_students cs where cs.class_id = class_uuid and cs.student_id = auth.uid())
$$;
create function public.can_take_assessment(assessment_uuid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.assessments a join public.profiles p on p.id = auth.uid()
    where a.id = assessment_uuid and p.role = 'student' and p.active
      and a.status = 'published' and a.active
      and (a.starts_at is null or a.starts_at <= now()) and (a.ends_at is null or a.ends_at >= now())
      and (a.target = 'all_active_students'
        or (a.target = 'grades' and p.grade = any(a.target_grades))
        or (a.target = 'selected_students' and exists (
          select 1 from public.assessment_assignments aa where aa.assessment_id = a.id and aa.student_id = auth.uid()
        )))
  )
$$;

alter table public.profiles enable row level security;
alter table public.teacher_students enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.sessions enable row level security;
alter table public.session_files enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_audit enable row level security;
alter table public.materials enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_assignments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_options enable row level security;
alter table public.assessment_option_scores enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.assessment_results enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin() or
  (public.current_role() = 'teacher' and role = 'student' and exists (
    select 1 from public.teacher_students ts where ts.teacher_id = auth.uid() and ts.student_id = id
  ))
);
create policy profiles_admin_insert on public.profiles for insert to authenticated with check (public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy teacher_students_read on public.teacher_students for select to authenticated using (
  teacher_id = auth.uid() or student_id = auth.uid() or public.is_admin()
);
create policy teacher_students_admin_write on public.teacher_students for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy classes_read on public.classes for select to authenticated using (public.can_access_class(id));
create policy classes_teacher_insert on public.classes for insert to authenticated
with check (teacher_id = auth.uid() and public.current_role() = 'teacher');
create policy classes_teacher_update on public.classes for update to authenticated
using (teacher_id = auth.uid() or public.is_admin()) with check (teacher_id = auth.uid() or public.is_admin());
create policy classes_admin_delete on public.classes for delete to authenticated using (public.is_admin());

create policy class_students_read on public.class_students for select to authenticated using (public.can_access_class(class_id));
create policy class_students_teacher_write on public.class_students for all to authenticated using (
  public.is_admin() or exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
) with check (
  public.is_admin() or exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
);

create policy sessions_read on public.sessions for select to authenticated using (public.can_access_class(class_id));
create policy sessions_teacher_write on public.sessions for all to authenticated using (
  public.is_admin() or exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
) with check (
  public.is_admin() or exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
);
create policy session_files_read on public.session_files for select to authenticated using (
  exists (select 1 from public.sessions s where s.id = session_id and public.can_access_class(s.class_id))
);
create policy session_files_teacher_write on public.session_files for all to authenticated using (
  public.is_admin() or exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id where s.id = session_id and c.teacher_id = auth.uid())
) with check (
  public.is_admin() or exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id where s.id = session_id and c.teacher_id = auth.uid())
);

create policy attendance_read on public.attendance for select to authenticated using (
  student_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.sessions s join public.classes c on c.id = s.class_id
    join public.teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = attendance.student_id
    where s.id = session_id and c.teacher_id = auth.uid()
  )
);
create policy attendance_teacher_write on public.attendance for all to authenticated using (
  public.is_admin() or exists (
    select 1 from public.sessions s join public.classes c on c.id = s.class_id
    join public.teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = attendance.student_id
    join public.class_students cs on cs.class_id = c.id and cs.student_id = attendance.student_id
    where s.id = session_id and c.teacher_id = auth.uid()
  )
) with check (
  (public.is_admin() or exists (
    select 1 from public.sessions s join public.classes c on c.id = s.class_id
    join public.teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = attendance.student_id
    where s.id = session_id and c.teacher_id = auth.uid()
  ))
  and exists (select 1 from public.sessions s join public.class_students cs on cs.class_id = s.class_id where s.id = session_id and cs.student_id = student_id)
);
create policy attendance_audit_read on public.attendance_audit for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.sessions s join public.classes c on c.id = s.class_id
    join public.teacher_students ts on ts.teacher_id = c.teacher_id and ts.student_id = attendance_audit.student_id
    where s.id = session_id and c.teacher_id = auth.uid()
  )
);

create policy materials_read_published on public.materials for select to authenticated using (published or public.is_admin());
create policy materials_admin_write on public.materials for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy assessments_admin_all on public.assessments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy assessments_student_read on public.assessments for select to authenticated using (public.can_take_assessment(id));
create policy assessment_assignments_admin_all on public.assessment_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy assessment_questions_read on public.assessment_questions for select to authenticated using (
  public.is_admin() or public.can_take_assessment(assessment_id)
);
create policy assessment_questions_admin_all on public.assessment_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy assessment_options_read on public.assessment_options for select to authenticated using (
  public.is_admin() or exists (select 1 from public.assessment_questions q where q.id = question_id and public.can_take_assessment(q.assessment_id))
);
create policy assessment_options_admin_all on public.assessment_options for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy assessment_option_scores_admin_only on public.assessment_option_scores for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy attempts_read_own_or_admin on public.assessment_attempts for select to authenticated using (student_id = auth.uid() or public.is_admin());
create policy answers_read_own_or_admin on public.assessment_answers for select to authenticated using (
  public.is_admin() or exists (select 1 from public.assessment_attempts a where a.id = attempt_id and a.student_id = auth.uid())
);
create policy results_admin_only on public.assessment_results for select to authenticated using (public.is_admin());

revoke all on all tables in schema public from anon;
revoke all on function public.enforce_class_student_assignment() from public, anon, authenticated;
revoke all on function public.enforce_teacher_student_roles() from public, anon, authenticated;
revoke all on function public.revoke_class_membership_after_unassignment() from public, anon, authenticated;
revoke all on function public.audit_attendance_change() from public, anon, authenticated;
revoke all on function public.current_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.can_access_class(uuid) from public, anon;
revoke all on function public.can_take_assessment(uuid) from public, anon;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_class(uuid) to authenticated;
grant execute on function public.can_take_assessment(uuid) to authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
