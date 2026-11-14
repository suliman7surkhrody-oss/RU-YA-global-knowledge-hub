-- AUREVIA live classroom scheduling enhancements
alter table public.class_sessions
  add column if not exists video_provider text not null default 'external'
    check (video_provider in ('google_meet','jitsi','zoom','microsoft_teams','external')),
  add column if not exists recording_url text,
  add column if not exists materials_url text,
  add column if not exists is_published boolean not null default true,
  add column if not exists reminder_minutes_before integer not null default 15
    check (reminder_minutes_before between 0 and 10080),
  add column if not exists join_instructions text not null default '';

create index if not exists class_sessions_section_start_idx
  on public.class_sessions(section_id, starts_at);
create index if not exists class_sessions_published_start_idx
  on public.class_sessions(is_published, starts_at);

comment on column public.class_sessions.video_provider is
  'Video provider selected by the teacher; meeting_url stores the provider-generated join URL.';
comment on column public.class_sessions.recording_url is
  'Optional recording link after the class.';
comment on column public.class_sessions.materials_url is
  'Optional class slides or lesson materials link.';
