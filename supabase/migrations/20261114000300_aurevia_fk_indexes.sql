-- Add covering indexes for foreign keys introduced by AUREVIA GED features.
create index if not exists community_messages_sender_idx on public.community_messages(sender_id);
create index if not exists fee_invoices_created_by_idx on public.fee_invoices(created_by);
create index if not exists fee_payments_recorded_by_idx on public.fee_payments(recorded_by);
create index if not exists fee_payments_student_idx on public.fee_payments(student_id);
create index if not exists ged_exam_attempts_subject_idx on public.ged_exam_attempts(subject_id);
create index if not exists ged_exam_responses_question_idx on public.ged_exam_responses(question_id);
create index if not exists ged_lessons_created_by_idx on public.ged_lessons(created_by);
create index if not exists ged_questions_created_by_idx on public.ged_questions(created_by);
create index if not exists notification_rules_updated_by_idx on public.notification_rules(updated_by);
create index if not exists notifications_created_by_idx on public.notifications(created_by);
