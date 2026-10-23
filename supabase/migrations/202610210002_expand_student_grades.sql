alter table public.profiles
  drop constraint if exists profiles_grade_check;

alter table public.profiles
  add constraint profiles_grade_check
  check (grade in (7, 8, 9, 10, 11, 12));
