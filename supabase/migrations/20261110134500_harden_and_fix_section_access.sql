-- RU'YA demo hardening and correctness fixes.
-- Apply after 20261102000100_initial_platform.sql.

-- Keep privileged functions on fixed search paths.
alter function public.set_updated_at() set search_path = pg_catalog, public;
alter function public.protect_profile_privileges() set search_path = pg_catalog, public, auth;
alter function public.protect_submission_grade() set search_path = pg_catalog, public, auth;
alter function public.protect_message_content() set search_path = pg_catalog, public, auth;
alter function public.validate_submission_file_path() set search_path = pg_catalog, public, auth;
alter function public.validate_library_file_path() set search_path = pg_catalog, public, auth;

-- Trigger-only function must not be callable as a public RPC.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Internal authorization helpers are available only to authenticated users.
revoke all on function public.is_active_member() from public, anon;
revoke all on function public.is_management() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_teacher() from public, anon;
revoke all on function public.get_message_recipients() from public, anon;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_management() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.get_message_recipients() to authenticated;

-- A private SECURITY DEFINER helper prevents an RLS recursion cycle
-- between class_sections and enrollments. It is not exposed through the Data API
-- and is callable only by authenticated users; auth.uid() scopes every lookup.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_enrolled_in_section(_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $
  select exists (
    select 1 from public.enrollments e
    where e.section_id = _section_id
      and e.student_id = (select auth.uid())
      and e.status = 'active'
  );
$;
revoke all on function private.is_enrolled_in_section(uuid) from public, anon;
grant execute on function private.is_enrolled_in_section(uuid) to authenticated;

-- Correct the student-to-section relationship and avoid recursive RLS reads.
drop policy if exists "sections visible to enrolled or staff" on public.class_sections;
create policy "sections visible to enrolled or staff" on public.class_sections
for select to authenticated
using (
  (select public.is_management())
  or ((select public.is_teacher()) and teacher_id=(select auth.uid()))
  or (select private.is_enrolled_in_section(class_sections.id))
);

-- Evaluate account status once per statement, not once per row.
do $$
declare t text;
begin
  foreach t in array array['profiles','academic_terms','courses','class_sections','enrollments','class_sessions','attendance','assignments','submissions','library_resources','announcements','messages'] loop
    execute format('drop policy if exists "active accounts only" on public.%I',t);
    execute format(
      'create policy "active accounts only" on public.%I as restrictive for all to authenticated using ((select public.is_active_member())) with check ((select public.is_active_member()))',
      t
    );
  end loop;
end $$;

-- Index foreign-key columns used by joins and role-scoped policies.
create index if not exists announcements_created_by_idx on public.announcements(created_by);
create index if not exists assignments_created_by_idx on public.assignments(created_by);
create index if not exists assignments_section_id_idx on public.assignments(section_id);
create index if not exists attendance_marked_by_idx on public.attendance(marked_by);
create index if not exists attendance_student_id_idx on public.attendance(student_id);
create index if not exists class_sections_course_id_idx on public.class_sections(course_id);
create index if not exists class_sections_term_id_idx on public.class_sections(term_id);
create index if not exists class_sessions_section_id_idx on public.class_sessions(section_id);
create index if not exists courses_created_by_idx on public.courses(created_by);
create index if not exists library_resources_course_id_idx on public.library_resources(course_id);
create index if not exists library_resources_uploaded_by_idx on public.library_resources(uploaded_by);
create index if not exists messages_recipient_id_idx on public.messages(recipient_id);
create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists submissions_graded_by_idx on public.submissions(graded_by);
