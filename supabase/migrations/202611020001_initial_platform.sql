-- RU'YA Global Knowledge Hub: initial secure academic platform
-- Apply through Supabase SQL Editor or Supabase CLI.
create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('student','teacher','management');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.enrollment_status as enum ('pending','active','completed','withdrawn');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.attendance_status as enum ('present','late','absent','excused');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.submission_status as enum ('draft','submitted','graded','returned');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.resource_visibility as enum ('public','authenticated','enrolled','staff');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.app_role not null default 'student',
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_email_lower_idx on public.profiles(lower(email));

-- A new account is always a student. Staff roles are assigned by management
-- from a trusted SQL/admin context, never from public sign-up metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,full_name,role)
  values(new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''), 'student')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_management()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='management' and is_active)
$$;
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role in ('teacher','management') and is_active)
$$;

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create unique index if not exists one_current_academic_term on public.academic_terms(is_current) where is_current;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null default '',
  level text,
  category text,
  cover_url text,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.class_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  term_id uuid references public.academic_terms(id) on delete set null,
  title text not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  meeting_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer check (capacity is null or capacity > 0),
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.class_sections(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.enrollment_status not null default 'pending',
  enrolled_at timestamptz not null default now(),
  unique(section_id,student_id)
);
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.class_sections(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  meeting_url text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.attendance_status not null default 'present',
  note text,
  marked_by uuid references public.profiles(id) on delete set null,
  marked_at timestamptz not null default now(),
  unique(session_id,student_id)
);
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.class_sections(id) on delete cascade,
  title text not null,
  instructions text not null default '',
  due_at timestamptz,
  max_score numeric(7,2) not null default 100 check(max_score > 0),
  attachment_path text,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  text_response text not null default '',
  file_path text,
  status public.submission_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  score numeric(7,2),
  feedback text,
  graded_by uuid references public.profiles(id) on delete set null,
  graded_at timestamptz,
  unique(assignment_id,student_id)
);
create table if not exists public.library_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'General',
  resource_type text not null default 'link',
  storage_path text,
  external_url text,
  visibility public.resource_visibility not null default 'authenticated',
  course_id uuid references public.courses(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience public.app_role[],
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null default '',
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check(sender_id <> recipient_id)
);

create index if not exists sections_teacher_idx on public.class_sections(teacher_id);
create index if not exists enrollments_student_idx on public.enrollments(student_id,status);
create index if not exists sessions_start_idx on public.class_sessions(starts_at);
create index if not exists assignments_due_idx on public.assignments(due_at);
create index if not exists submissions_student_idx on public.submissions(student_id);
create index if not exists announcements_published_idx on public.announcements(published_at desc);

-- Keep privileged fields out of self-service profile updates.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role <> old.role or new.is_active <> old.is_active or new.email <> old.email then
      raise exception 'Role, account status and email are managed by RU''YA administrators.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges before update on public.profiles
for each row execute procedure public.protect_profile_privileges();

-- Enable RLS everywhere.
alter table public.profiles enable row level security;
alter table public.academic_terms enable row level security;
alter table public.courses enable row level security;
alter table public.class_sections enable row level security;
alter table public.enrollments enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.library_resources enable row level security;
alter table public.announcements enable row level security;
alter table public.messages enable row level security;

-- Profiles
drop policy if exists "profiles read self staff" on public.profiles;
create policy "profiles read self staff" on public.profiles for select to authenticated
using(id=auth.uid() or public.is_management() or exists(select 1 from public.enrollments e join public.class_sections cs on cs.id=e.section_id where e.student_id=profiles.id and cs.teacher_id=auth.uid()));
drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles for update to authenticated
using(id=auth.uid() or public.is_management())
with check(id=auth.uid() or public.is_management());
drop policy if exists "management manage profiles" on public.profiles;
create policy "management manage profiles" on public.profiles for all to authenticated
using(public.is_management()) with check(public.is_management());

-- Academic catalogue
drop policy if exists "terms visible to signed in" on public.academic_terms;
create policy "terms visible to signed in" on public.academic_terms for select to authenticated using(true);
drop policy if exists "management manage terms" on public.academic_terms;
create policy "management manage terms" on public.academic_terms for all to authenticated using(public.is_management()) with check(public.is_management());

drop policy if exists "published courses visible" on public.courses;
create policy "published courses visible" on public.courses for select to authenticated using(is_published or public.is_staff());
drop policy if exists "management manage courses" on public.courses;
create policy "management manage courses" on public.courses for all to authenticated using(public.is_management()) with check(public.is_management());

drop policy if exists "sections visible to enrolled or staff" on public.class_sections;
create policy "sections visible to enrolled or staff" on public.class_sections for select to authenticated
using(public.is_management() or teacher_id=auth.uid() or exists(select 1 from public.enrollments e where e.section_id=id and e.student_id=auth.uid() and e.status='active'));
drop policy if exists "management and assigned teachers manage sections" on public.class_sections;
create policy "management and assigned teachers manage sections" on public.class_sections for all to authenticated
using(public.is_management() or teacher_id=auth.uid()) with check(public.is_management() or teacher_id=auth.uid());

drop policy if exists "enrollment visible to owner or staff" on public.enrollments;
create policy "enrollment visible to owner or staff" on public.enrollments for select to authenticated using(student_id=auth.uid() or public.is_management() or exists(select 1 from public.class_sections cs where cs.id=section_id and cs.teacher_id=auth.uid()));
drop policy if exists "management manage enrollments" on public.enrollments;
create policy "management manage enrollments" on public.enrollments for all to authenticated using(public.is_management()) with check(public.is_management());

-- Sessions, attendance and assessment
drop policy if exists "sessions visible to class" on public.class_sessions;
create policy "sessions visible to class" on public.class_sessions for select to authenticated
using(public.is_management() or exists(select 1 from public.class_sections cs where cs.id=class_sessions.section_id and cs.teacher_id=auth.uid()) or exists(select 1 from public.enrollments e where e.section_id=class_sessions.section_id and e.student_id=auth.uid() and e.status='active'));
drop policy if exists "staff manage sessions" on public.class_sessions;
create policy "staff manage sessions" on public.class_sessions for all to authenticated
using(public.is_management() or exists(select 1 from public.class_sections s where s.id=section_id and s.teacher_id=auth.uid()))
with check(public.is_management() or exists(select 1 from public.class_sections s where s.id=section_id and s.teacher_id=auth.uid()));

drop policy if exists "attendance visible to student or staff" on public.attendance;
create policy "attendance visible to student or staff" on public.attendance for select to authenticated using(student_id=auth.uid() or public.is_management() or exists(select 1 from public.class_sessions cs join public.class_sections sec on sec.id=cs.section_id where cs.id=attendance.session_id and sec.teacher_id=auth.uid()));
drop policy if exists "staff manage attendance" on public.attendance;
create policy "staff manage attendance" on public.attendance for all to authenticated
using(public.is_management() or exists(select 1 from public.class_sessions cs join public.class_sections s on s.id=cs.section_id where cs.id=session_id and s.teacher_id=auth.uid()))
with check((public.is_management() or exists(select 1 from public.class_sessions cs join public.class_sections s on s.id=cs.section_id where cs.id=session_id and s.teacher_id=auth.uid())) and exists(select 1 from public.class_sessions cs join public.enrollments e on e.section_id=cs.section_id where cs.id=session_id and e.student_id=attendance.student_id and e.status='active'));

drop policy if exists "assignments visible to class" on public.assignments;
create policy "assignments visible to class" on public.assignments for select to authenticated
using(public.is_management() or exists(select 1 from public.class_sections cs where cs.id=assignments.section_id and cs.teacher_id=auth.uid()) or (is_published and exists(select 1 from public.enrollments e where e.section_id=assignments.section_id and e.student_id=auth.uid() and e.status='active')));
drop policy if exists "staff manage assignments" on public.assignments;
create policy "staff manage assignments" on public.assignments for all to authenticated
using(public.is_management() or exists(select 1 from public.class_sections s where s.id=section_id and s.teacher_id=auth.uid()))
with check(public.is_management() or exists(select 1 from public.class_sections s where s.id=section_id and s.teacher_id=auth.uid()));

drop policy if exists "submissions visible to owner or assigned staff" on public.submissions;
create policy "submissions visible to owner or assigned staff" on public.submissions for select to authenticated
using(student_id=auth.uid() or public.is_management() or exists(select 1 from public.assignments a join public.class_sections s on s.id=a.section_id where a.id=assignment_id and s.teacher_id=auth.uid()));
drop policy if exists "students submit to own enrolled assignments" on public.submissions;
create policy "students submit to own enrolled assignments" on public.submissions for insert to authenticated
with check(student_id=auth.uid() and exists(select 1 from public.assignments a join public.enrollments e on e.section_id=a.section_id where a.id=assignment_id and e.student_id=auth.uid() and e.status='active' and a.is_published));
drop policy if exists "students update own ungraded submissions" on public.submissions;
create policy "students update own ungraded submissions" on public.submissions for update to authenticated
using(student_id=auth.uid() and status in ('draft','submitted') and score is null)
with check(student_id=auth.uid() and status in ('draft','submitted') and score is null and exists(select 1 from public.assignments a join public.enrollments e on e.section_id=a.section_id where a.id=assignment_id and e.student_id=auth.uid() and e.status='active' and a.is_published));
drop policy if exists "staff grade submissions" on public.submissions;
create policy "staff grade submissions" on public.submissions for update to authenticated
using(public.is_management() or exists(select 1 from public.assignments a join public.class_sections s on s.id=a.section_id where a.id=assignment_id and s.teacher_id=auth.uid()))
with check(public.is_management() or exists(select 1 from public.assignments a join public.class_sections s on s.id=a.section_id where a.id=assignment_id and s.teacher_id=auth.uid()));

-- Library and communications
drop policy if exists "library access by visibility" on public.library_resources;
create policy "library access by visibility" on public.library_resources for select to authenticated
using(visibility in ('authenticated','public') or public.is_staff() or
 (visibility='enrolled' and course_id is not null and exists(select 1 from public.enrollments e join public.class_sections s on s.id=e.section_id where s.course_id=library_resources.course_id and e.student_id=auth.uid() and e.status='active')));
drop policy if exists "staff manage library" on public.library_resources;
create policy "staff manage library" on public.library_resources for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists "published announcements visible" on public.announcements;
create policy "published announcements visible" on public.announcements for select to authenticated
using(published_at is not null and published_at <= now() and (audience is null or (select role from public.profiles where id=auth.uid())=any(audience)) or public.is_management());
drop policy if exists "management manage announcements" on public.announcements;
create policy "management manage announcements" on public.announcements for all to authenticated using(public.is_management()) with check(public.is_management());

drop policy if exists "messages visible to participants" on public.messages;
create policy "messages visible to participants" on public.messages for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid() or public.is_management());
drop policy if exists "send messages as self" on public.messages;
create policy "send messages as self" on public.messages for insert to authenticated with check(sender_id=auth.uid() and recipient_id<>auth.uid() and exists(select 1 from public.get_message_recipients() r where r.id=recipient_id));
drop policy if exists "recipient marks message read" on public.messages;
create policy "recipient marks message read" on public.messages for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());


-- Role-scoped recipient directory; exposes names and roles, never email addresses.
create or replace function public.get_message_recipients()
returns table(id uuid, full_name text, role public.app_role)
language sql stable security definer set search_path = public as $
 select p.id,p.full_name,p.role
 from public.profiles p
 where p.is_active and p.id <> auth.uid()
 and (
   public.is_management()
   or p.role='management'
   or exists(select 1 from public.class_sections cs join public.enrollments e on e.section_id=cs.id
             where cs.teacher_id=auth.uid() and e.student_id=p.id and e.status='active')
   or exists(select 1 from public.enrollments e join public.class_sections cs on cs.id=e.section_id
             where e.student_id=auth.uid() and cs.teacher_id=p.id and e.status='active')
 )
 order by p.full_name
$;
grant execute on function public.get_message_recipients() to authenticated;


-- Learners cannot forge grades or feedback by editing their own submission.
create or replace function public.protect_submission_grade()
returns trigger language plpgsql as $
begin
 if auth.uid() = old.student_id and (
   new.score is distinct from old.score or
   new.feedback is distinct from old.feedback or
   new.graded_by is distinct from old.graded_by or
   new.graded_at is distinct from old.graded_at
 ) then
   raise exception 'Only the assigned teaching team can grade submissions.';
 end if;
 return new;
end $;
drop trigger if exists protect_submission_grade on public.submissions;
create trigger protect_submission_grade before update on public.submissions
for each row execute procedure public.protect_submission_grade();

-- Message recipients may mark a message read, but cannot rewrite its contents.
create or replace function public.protect_message_content()
returns trigger language plpgsql as $
begin
 if auth.uid() = old.recipient_id and (
   new.sender_id is distinct from old.sender_id or
   new.recipient_id is distinct from old.recipient_id or
   new.subject is distinct from old.subject or
   new.body is distinct from old.body or
   new.created_at is distinct from old.created_at
 ) then
   raise exception 'Message content cannot be changed by the recipient.';
 end if;
 return new;
end $;
drop trigger if exists protect_message_content on public.messages;
create trigger protect_message_content before update on public.messages
for each row execute procedure public.protect_message_content();

-- Updated-at triggers
do $$ declare t text; begin
 foreach t in array array['profiles','courses','class_sections','assignments'] loop
  execute format('drop trigger if exists set_updated_at on public.%I',t);
  execute format('create trigger set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()',t);
 end loop;
end $$;

-- NOTE: Create a private Storage bucket named "ruya-private" in Supabase.
-- Add Storage policies separately after the organization confirms its file access rules.
