-- AUREVIA GED Academy: public GED learning, community, billing and notification foundations.
-- Additive migration. Existing academic records and account IDs are preserved.

create table if not exists public.ged_subjects (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  title_en text not null, title_dari text not null,
  summary_en text not null default '', summary_dari text not null default '',
  exam_duration_minutes integer not null check (exam_duration_minutes > 0),
  topics jsonb not null default '[]'::jsonb, sort_order integer not null default 0,
  is_published boolean not null default true, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.ged_lessons (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.ged_subjects(id) on delete cascade,
  module_title_en text not null default '', module_title_dari text not null default '',
  title_en text not null, title_dari text not null,
  summary_en text not null default '', summary_dari text not null default '',
  content_en text not null default '', content_dari text not null default '',
  resource_url text, sort_order integer not null default 0,
  estimated_minutes integer not null default 15 check (estimated_minutes > 0),
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Keep answer keys separate from public question content.
create table if not exists public.ged_questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.ged_subjects(id) on delete cascade,
  topic text not null default '',
  question_type text not null default 'multiple_choice'
    check (question_type in ('multiple_choice','multiple_select','short_answer','numeric','extended_response')),
  prompt_en text not null, prompt_dari text not null default '',
  options jsonb not null default '[]'::jsonb,
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  source_type text not null default 'original'
    check (source_type in ('original','public_domain','licensed','attributed_reference')),
  source_note text not null default '', is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ged_answer_keys (
  question_id uuid primary key references public.ged_questions(id) on delete cascade,
  correct_answer jsonb not null, explanation_en text not null default '',
  explanation_dari text not null default '', updated_at timestamptz not null default now()
);
create table if not exists public.ged_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.ged_subjects(id) on delete restrict,
  status text not null default 'in_progress'
    check (status in ('in_progress','submitted','graded','abandoned')),
  started_at timestamptz not null default now(), submitted_at timestamptz,
  score numeric(7,2), max_score numeric(7,2), graded_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.ged_exam_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ged_exam_attempts(id) on delete cascade,
  question_id uuid not null references public.ged_questions(id) on delete restrict,
  response jsonb not null, answered_at timestamptz not null default now(),
  unique(attempt_id,question_id)
);
create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(), room_key text not null default 'general',
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 3000),
  created_at timestamptz not null default now(), edited_at timestamptz, deleted_at timestamptz
);
create table if not exists public.fee_invoices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, description text not null default '', billing_period text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','partial','paid','overdue','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.fee_invoices(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  payment_method text not null default 'cash', transaction_reference text not null default '',
  receipt_path text, verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected')),
  paid_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, body text not null,
  notification_type text not null default 'general'
    check (notification_type in ('homework','weekly_lesson','fee_reminder','class_change','message','exam','general')),
  action_url text, scheduled_for timestamptz not null default now(), sent_at timestamptz,
  read_at timestamptz, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  daily_homework boolean not null default true, weekly_lesson boolean not null default true,
  monthly_fee boolean not null default true, browser_notifications boolean not null default false,
  email_notifications boolean not null default true, timezone text not null default 'Asia/Kabul',
  updated_at timestamptz not null default now()
);
create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(), event_type text not null unique
    check (event_type in ('homework_daily','lesson_weekly','fee_monthly')),
  title_en text not null, title_dari text not null, body_en text not null, body_dari text not null,
  day_of_week integer check (day_of_week between 0 and 6),
  day_of_month integer check (day_of_month between 1 and 28),
  send_time time not null default '18:00', timezone text not null default 'Asia/Kabul',
  enabled boolean not null default true, updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.ged_subjects(code,title_en,title_dari,summary_en,summary_dari,exam_duration_minutes,topics,sort_order)
values
('MATH','Mathematical Reasoning','استدلال ریاضی','Build quantitative and algebraic problem-solving skills.','مهارت‌های حل مسئله در ریاضیات کمی و جبر را تقویت کنید.',115,'["Basic Math","Geometry","Basic Algebra","Graphs and Functions"]'::jsonb,1),
('RLA','Reasoning Through Language Arts','استدلال از طریق هنرهای زبانی','Strengthen reading comprehension, argument analysis, writing and grammar.','درک مطلب، تحلیل استدلال، نوشتن و دستور زبان را تقویت کنید.',150,'["Reading for Meaning","Identifying and Creating Arguments","Grammar and Language"]'::jsonb,2),
('SOCIAL','Social Studies','مطالعات اجتماعی','Interpret historical and civic information, arguments, numbers and graphs.','اطلاعات تاریخی و مدنی، استدلال‌ها، ارقام و نمودارها را تحلیل کنید.',70,'["Reading for Meaning in Social Studies","Analyzing Historical Events and Arguments","Using Numbers and Graphs"]'::jsonb,3),
('SCIENCE','Science','علوم','Develop scientific reading, experiment analysis and data interpretation skills.','مهارت خواندن علمی، تحلیل آزمایش‌ها و تفسیر داده‌ها را توسعه دهید.',90,'["Reading for Meaning in Science","Designing and Interpreting Science Experiments","Using Numbers and Graphics"]'::jsonb,4)
on conflict(code) do nothing;
insert into public.notification_rules(event_type,title_en,title_dari,body_en,body_dari,day_of_week,day_of_month,send_time)
values
('homework_daily','Daily homework reminder','یادآوری روزانه کارخانگی','Check your assignments and upcoming deadlines.','کارخانگی‌ها و مهلت‌های نزدیک خود را بررسی کنید.',null,null,'18:00'),
('lesson_weekly','Weekly GED study plan','برنامه هفتگی درس GED','Review this week’s lessons and live class schedule.','درس‌های این هفته و برنامه صنف‌های آنلاین را مرور کنید.',0,null,'18:00'),
('fee_monthly','Monthly fee reminder','یادآوری ماهانه فیس','Review your monthly fee and payment status.','فیس ماهانه و وضعیت پرداخت خود را بررسی کنید.',null,1,'09:00')
on conflict(event_type) do nothing;
alter table public.ged_subjects enable row level security;
alter table public.ged_lessons enable row level security;
alter table public.ged_questions enable row level security;
alter table public.ged_answer_keys enable row level security;
alter table public.ged_exam_attempts enable row level security;
alter table public.ged_exam_responses enable row level security;
alter table public.community_messages enable row level security;
alter table public.fee_invoices enable row level security;
alter table public.fee_payments enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_rules enable row level security;
grant select on public.ged_subjects,public.ged_lessons,public.ged_questions to anon,authenticated;
grant insert,update,delete on public.ged_subjects,public.ged_lessons,public.ged_questions to authenticated;
grant select,insert,update,delete on public.ged_answer_keys to authenticated;
grant select,insert on public.ged_exam_attempts to authenticated;
grant select,insert,update on public.ged_exam_responses to authenticated;
grant select,insert,delete on public.community_messages to authenticated;
grant select,insert,update,delete on public.fee_invoices to authenticated;
grant select,insert,update on public.fee_payments to authenticated;
grant select,insert on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant select,insert,update on public.notification_preferences to authenticated;
grant select,insert,update,delete on public.notification_rules to authenticated;
create policy "published GED subjects are public" on public.ged_subjects for select to anon,authenticated using(is_published);
create policy "staff manage GED subjects" on public.ged_subjects for all to authenticated using((select public.is_staff())) with check((select public.is_staff()));
create policy "published GED lessons are public" on public.ged_lessons for select to anon,authenticated using(is_published);
create policy "staff manage GED lessons" on public.ged_lessons for all to authenticated using((select public.is_staff())) with check((select public.is_staff()));
create policy "published GED questions are public" on public.ged_questions for select to anon,authenticated using(is_published);
create policy "staff manage GED questions" on public.ged_questions for all to authenticated using((select public.is_staff())) with check((select public.is_staff()));
create policy "answer keys staff only" on public.ged_answer_keys for all to authenticated using((select public.is_staff())) with check((select public.is_staff()));
create policy "students read own GED attempts" on public.ged_exam_attempts for select to authenticated using(student_id=(select auth.uid()) or (select public.is_staff()));
create policy "students start own GED attempts" on public.ged_exam_attempts for insert to authenticated with check(student_id=(select auth.uid()) and status='in_progress' and score is null and max_score is null);
create policy "students read own GED responses" on public.ged_exam_responses for select to authenticated using(exists(select 1 from public.ged_exam_attempts a where a.id=attempt_id and (a.student_id=(select auth.uid()) or (select public.is_staff()))));
create policy "students save responses during own active attempt" on public.ged_exam_responses for insert to authenticated with check(exists(select 1 from public.ged_exam_attempts a where a.id=attempt_id and a.student_id=(select auth.uid()) and a.status='in_progress'));
create policy "students revise responses during own active attempt" on public.ged_exam_responses for update to authenticated using(exists(select 1 from public.ged_exam_attempts a where a.id=attempt_id and a.student_id=(select auth.uid()) and a.status='in_progress')) with check(exists(select 1 from public.ged_exam_attempts a where a.id=attempt_id and a.student_id=(select auth.uid()) and a.status='in_progress'));
create policy "active learners read community chat" on public.community_messages for select to authenticated using((select public.is_active_member()) and deleted_at is null);
create policy "active learners send community chat" on public.community_messages for insert to authenticated with check(sender_id=(select auth.uid()) and (select public.is_active_member()));
create policy "staff moderate community chat" on public.community_messages for delete to authenticated using((select public.is_staff()));
create policy "students read own fee invoices" on public.fee_invoices for select to authenticated using(student_id=(select auth.uid()) or (select public.is_management()));
create policy "management manage fee invoices" on public.fee_invoices for all to authenticated using((select public.is_management())) with check((select public.is_management()));
create policy "students read own fee payments" on public.fee_payments for select to authenticated using(student_id=(select auth.uid()) or (select public.is_management()));
create policy "students submit own payment proof" on public.fee_payments for insert to authenticated with check(student_id=(select auth.uid()) and verification_status='pending' and recorded_by is null);
create policy "management verify fee payments" on public.fee_payments for update to authenticated using((select public.is_management())) with check((select public.is_management()));
create policy "users read own notifications" on public.notifications for select to authenticated using(recipient_id=(select auth.uid()) or (select public.is_management()));
create policy "staff create notifications" on public.notifications for insert to authenticated with check((select public.is_staff()) and created_by=(select auth.uid()));
create policy "users mark own notifications read" on public.notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
create policy "users manage own notification preferences" on public.notification_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "staff read notification rules" on public.notification_rules for select to authenticated using((select public.is_staff()));
create policy "management manage notification rules" on public.notification_rules for all to authenticated using((select public.is_management())) with check((select public.is_management()));
grant select on public.library_resources to anon;
create policy "public library resource catalogue" on public.library_resources for select to anon using(visibility='public');
create index if not exists ged_lessons_subject_order_idx on public.ged_lessons(subject_id,sort_order);
create index if not exists ged_questions_subject_topic_idx on public.ged_questions(subject_id,topic);
create index if not exists ged_attempts_student_idx on public.ged_exam_attempts(student_id,started_at desc);
create index if not exists ged_responses_attempt_idx on public.ged_exam_responses(attempt_id);
create index if not exists community_messages_room_created_idx on public.community_messages(room_key,created_at desc);
create index if not exists fee_invoices_student_due_idx on public.fee_invoices(student_id,due_date desc);
create index if not exists fee_payments_invoice_idx on public.fee_payments(invoice_id,created_at desc);
create index if not exists notifications_recipient_schedule_idx on public.notifications(recipient_id,scheduled_for desc);
create index if not exists notifications_unread_idx on public.notifications(recipient_id) where read_at is null;
drop trigger if exists ged_subjects_updated_at on public.ged_subjects;
create trigger ged_subjects_updated_at before update on public.ged_subjects for each row execute procedure public.set_updated_at();
drop trigger if exists ged_lessons_updated_at on public.ged_lessons;
create trigger ged_lessons_updated_at before update on public.ged_lessons for each row execute procedure public.set_updated_at();
drop trigger if exists ged_questions_updated_at on public.ged_questions;
create trigger ged_questions_updated_at before update on public.ged_questions for each row execute procedure public.set_updated_at();
drop trigger if exists fee_invoices_updated_at on public.fee_invoices;
create trigger fee_invoices_updated_at before update on public.fee_invoices for each row execute procedure public.set_updated_at();
drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at before update on public.notification_preferences for each row execute procedure public.set_updated_at();
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_messages') then
    alter publication supabase_realtime add table public.community_messages;
  end if;
end $$;
