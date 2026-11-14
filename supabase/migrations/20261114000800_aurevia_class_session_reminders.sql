-- Per-session reminders for published online lessons.
alter table public.notification_preferences
  add column if not exists class_session_reminders boolean not null default true;

create or replace function public.generate_class_session_reminders()
returns integer language plpgsql security invoker set search_path = pg_catalog, public
as $function$
declare inserted_count integer := 0;
begin
  insert into public.notifications(recipient_id,title,body,notification_type,action_url,scheduled_for,sent_at,dedupe_key)
  select e.student_id,
    case when coalesce(np.preferred_language,'en')='prs' then 'صنف آنلاین شما به‌زودی آغاز می‌شود' else 'Your online class starts soon' end,
    case when coalesce(np.preferred_language,'en')='prs'
      then 'صنف «'||s.title||'» در تاریخ '||to_char(s.starts_at at time zone coalesce(np.timezone,'Asia/Kabul'),'YYYY-MM-DD HH24:MI')||' آغاز می‌شود.'
      else 'Your class "'||s.title||'" starts at '||to_char(s.starts_at at time zone coalesce(np.timezone,'Asia/Kabul'),'YYYY-MM-DD HH24:MI')||'.' end,
    'class_session','/?section=classes',now(),now(),'class_session:'||s.id::text||':'||e.student_id::text
  from public.class_sessions s
  join public.enrollments e on e.section_id=s.section_id and e.status='active'
  join public.profiles p on p.id=e.student_id and p.is_active
  left join public.notification_preferences np on np.user_id=e.student_id
  where s.is_published and s.starts_at>now()
    and s.starts_at<=now()+make_interval(mins=>s.reminder_minutes_before)
    and coalesce(np.class_session_reminders,true)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end
$function$;
revoke all on function public.generate_class_session_reminders() from public,anon,authenticated;
select cron.schedule('aurevia-class-session-reminders-5m','*/5 * * * *','select public.generate_class_session_reminders();');
