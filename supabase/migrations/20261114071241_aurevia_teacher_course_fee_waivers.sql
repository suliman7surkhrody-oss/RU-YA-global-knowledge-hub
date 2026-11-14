-- AUREVIA: teacher-approved full course-fee waivers.
create table if not exists public.fee_waivers (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.enrollments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  reason text not null check (length(trim(reason)) between 8 and 1000),
  created_at timestamptz not null default now()
);
alter table public.fee_waivers enable row level security;
revoke all on public.fee_waivers from anon, authenticated;
grant select on public.fee_waivers to authenticated;
drop policy if exists "fee waivers visible to involved parties" on public.fee_waivers;
create policy "fee waivers visible to involved parties"
on public.fee_waivers for select to authenticated
using (
  (select public.is_management())
  or student_id = (select auth.uid())
  or exists (
    select 1 from public.class_sections s
    where s.id = (select e.section_id from public.enrollments e where e.id = fee_waivers.enrollment_id)
      and s.teacher_id = (select auth.uid())
      and (select public.is_teacher())
  )
);
create or replace function public.grant_course_fee_waiver(_enrollment_id uuid, _reason text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := (select auth.uid());
  enrollment_row public.enrollments%rowtype;
  waiver_id uuid;
begin
  if actor_id is null or not public.is_active_member() then
    raise exception 'Sign in with an active AUREVIA account.';
  end if;
  if not (public.is_management() or public.is_teacher()) then
    raise exception 'Only an assigned teacher or management can grant a fee waiver.';
  end if;
  if length(trim(coalesce(_reason,''))) < 8 or length(trim(_reason)) > 1000 then
    raise exception 'Enter a reason between 8 and 1000 characters.';
  end if;
  select * into enrollment_row from public.enrollments where id = _enrollment_id for update;
  if not found then raise exception 'Course registration not found.'; end if;
  if public.is_teacher() and not exists (
    select 1 from public.class_sections s
    where s.id = enrollment_row.section_id and s.teacher_id = actor_id
  ) then
    raise exception 'You can only waive fees for learners in your assigned classes.';
  end if;
  if enrollment_row.status not in ('pending','active') then
    raise exception 'Only current course registrations can receive a fee waiver.';
  end if;
  if exists (
    select 1 from public.fee_payments p
    join public.fee_invoices i on i.id = p.invoice_id
    where i.enrollment_id = enrollment_row.id
  ) then
    raise exception 'A payment has already been submitted for this registration. Ask management to review it before applying a waiver.';
  end if;
  insert into public.fee_waivers(enrollment_id,student_id,course_id,teacher_id,reason)
  values(enrollment_row.id,enrollment_row.student_id,enrollment_row.course_id,actor_id,trim(_reason))
  on conflict (enrollment_id) do update
    set teacher_id=excluded.teacher_id, reason=excluded.reason, created_at=now()
  returning id into waiver_id;
  update public.fee_invoices set status='waived', updated_at=now()
    where enrollment_id=enrollment_row.id and status in ('pending','partial');
  update public.enrollments set status='active' where id=enrollment_row.id;
  return waiver_id;
end;
$$;
revoke all on function public.grant_course_fee_waiver(uuid,text) from public, anon;
grant execute on function public.grant_course_fee_waiver(uuid,text) to authenticated;
create or replace function private.student_has_paid_access(_student_id uuid, _course_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.enrollments e
    join public.courses c on c.id=e.course_id
    where e.student_id=_student_id and c.id=_course_id and e.status='active'
      and (
        c.access_type='free'
        or exists (
          select 1 from public.fee_invoices i
          where i.student_id=e.student_id and i.course_id=c.id
            and i.status='paid' and (i.enrollment_id is null or i.enrollment_id=e.id)
        )
        or exists (select 1 from public.fee_waivers w where w.enrollment_id=e.id)
      )
  )
$$;
