-- AUREVIA GED Academy: secure fee validation and scheduled in-app reminders.
alter table public.notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_dedupe_key_uidx on public.notifications(dedupe_key) where dedupe_key is not null;
alter table public.notification_preferences add column if not exists preferred_language text not null default 'en' check (preferred_language in ('en','prs'));
create or replace function public.validate_fee_payment_submission()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public, auth as $function$
declare invoice_amount numeric(12,2); invoice_currency char(3); already_verified numeric(12,2);
begin
  if auth.uid() is not null and new.student_id = (select auth.uid()) then
    select amount,currency into invoice_amount,invoice_currency from public.fee_invoices
    where id=new.invoice_id and student_id=(select auth.uid()) and status in ('pending','partial','overdue');
    if not found then raise exception 'This invoice does not belong to your account or is no longer payable.'; end if;
    select coalesce(sum(amount),0) into already_verified from public.fee_payments
    where invoice_id=new.invoice_id and verification_status='verified';
    if new.currency <> invoice_currency then raise exception 'Payment currency must match the invoice currency.'; end if;
    if new.amount > invoice_amount - already_verified then raise exception 'Payment amount exceeds the remaining invoice balance.'; end if;
    if new.verification_status <> 'pending' or new.recorded_by is not null then raise exception 'Student payment submissions must await management verification.'; end if;
  end if;
  return new;
end
$function$;
revoke all on function public.validate_fee_payment_submission() from public,anon,authenticated;
drop trigger if exists validate_fee_payment_submission on public.fee_payments;
create trigger validate_fee_payment_submission before insert on public.fee_payments for each row execute procedure public.validate_fee_payment_submission();
create or replace function public.generate_scheduled_notifications()
returns integer language plpgsql security invoker set search_path = pg_catalog, public as $function$
declare rule_row record; local_now timestamp; added integer; total_added integer := 0;
begin
  for rule_row in select * from public.notification_rules where enabled loop
    local_now := now() at time zone rule_row.timezone;
    if local_now::time < rule_row.send_time or local_now::time >= rule_row.send_time + interval '15 minutes' then continue; end if;
    if rule_row.day_of_week is not null and extract(dow from local_now)::integer <> rule_row.day_of_week then continue; end if;
    if rule_row.day_of_month is not null and extract(day from local_now)::integer <> rule_row.day_of_month then continue; end if;
    if rule_row.event_type='homework_daily' then
      insert into public.notifications(recipient_id,title,body,notification_type,scheduled_for,sent_at,dedupe_key)
      select d.student_id,case when coalesce(p.preferred_language,'en')='prs' then rule_row.title_dari else rule_row.title_en end,
        case when coalesce(p.preferred_language,'en')='prs' then rule_row.body_dari || ' تعداد کارخانگی‌های نزدیک: ' || d.assignment_count::text else rule_row.body_en || ' Assignments due soon: ' || d.assignment_count::text end,
        'homework',now(),now(),'homework_daily:'||d.student_id::text||':'||to_char(local_now::date,'YYYY-MM-DD')
      from (
        select e.student_id,count(distinct a.id)::integer as assignment_count
        from public.enrollments e join public.assignments a on a.section_id=e.section_id join public.profiles pr on pr.id=e.student_id and pr.is_active
        where e.status='active' and a.is_published and a.due_at>=now() and a.due_at<now()+interval '24 hours'
          and not exists(select 1 from public.submissions s where s.assignment_id=a.id and s.student_id=e.student_id and s.status in ('submitted','graded'))
        group by e.student_id
      ) d left join public.notification_preferences p on p.user_id=d.student_id
      where coalesce(p.daily_homework,true)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
      get diagnostics added = row_count; total_added := total_added + added;
    elsif rule_row.event_type='lesson_weekly' then
      insert into public.notifications(recipient_id,title,body,notification_type,scheduled_for,sent_at,dedupe_key)
      select d.student_id,case when coalesce(p.preferred_language,'en')='prs' then rule_row.title_dari else rule_row.title_en end,
        case when coalesce(p.preferred_language,'en')='prs' then rule_row.body_dari || ' تعداد جلسات آینده: ' || d.session_count::text else rule_row.body_en || ' Upcoming sessions: ' || d.session_count::text end,
        'weekly_lesson',now(),now(),'lesson_weekly:'||d.student_id::text||':'||to_char(local_now::date,'IYYY-IW')
      from (
        select e.student_id,count(distinct s.id)::integer as session_count
        from public.enrollments e join public.class_sections cs on cs.id=e.section_id join public.class_sessions s on s.section_id=cs.id join public.profiles pr on pr.id=e.student_id and pr.is_active
        where e.status='active' and s.starts_at>=now() and s.starts_at<now()+interval '7 days' group by e.student_id
      ) d left join public.notification_preferences p on p.user_id=d.student_id
      where coalesce(p.weekly_lesson,true)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
      get diagnostics added = row_count; total_added := total_added + added;
    elsif rule_row.event_type='fee_monthly' then
      insert into public.notifications(recipient_id,title,body,notification_type,scheduled_for,sent_at,dedupe_key)
      select d.student_id,case when coalesce(p.preferred_language,'en')='prs' then rule_row.title_dari else rule_row.title_en end,
        case when coalesce(p.preferred_language,'en')='prs' then rule_row.body_dari || ' تعداد صورتحساب‌های باز: ' || d.invoice_count::text else rule_row.body_en || ' Open invoices: ' || d.invoice_count::text end,
        'fee_reminder',now(),now(),'fee_monthly:'||d.student_id::text||':'||to_char(local_now::date,'YYYY-MM')
      from (
        select i.student_id,count(*)::integer as invoice_count from public.fee_invoices i join public.profiles pr on pr.id=i.student_id and pr.is_active
        where i.status in ('pending','partial','overdue') and i.due_date<=local_now::date+7 group by i.student_id
      ) d left join public.notification_preferences p on p.user_id=d.student_id
      where coalesce(p.monthly_fee,true)
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
      get diagnostics added = row_count; total_added := total_added + added;
    end if;
  end loop;
  return total_added;
end
$function$;
revoke all on function public.generate_scheduled_notifications() from public,anon,authenticated;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule('aurevia-ged-reminders-15m','*/15 * * * *','select public.generate_scheduled_notifications();');
