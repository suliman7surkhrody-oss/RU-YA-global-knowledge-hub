-- Tighten anonymous SQL privileges. Public users may read only published GED catalogue,
-- published lesson/question content and public library metadata. RLS still filters each row.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on public.ged_subjects,public.ged_lessons,public.ged_questions,public.library_resources to anon;

-- Prevent future tables created by the migration owner from inheriting broad anon grants.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
