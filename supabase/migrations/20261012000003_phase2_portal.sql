-- =============================================================================
-- Phase 2 — intern & employee portal
-- Documents (private storage), task submissions & review, self check-in,
-- attendance corrections, work logs, holidays, HR requests.
-- Run after 0001 and 0002. Safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Private file storage. No storage policies are created on purpose: only the
-- server (service role) reads/writes, and hands out short-lived signed URLs
-- after checking who is asking.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 4194304)
on conflict (id) do update set public = false, file_size_limit = 4194304;

-- ---------------------------------------------------------------------------
-- onboarding: one submission per person (the token page upserts on it)
-- ---------------------------------------------------------------------------
do $$ begin
  alter table public.onboarding_submissions add constraint onboarding_submissions_person_id_key unique (person_id);
exception when duplicate_object or duplicate_table then null; end $$;

-- ---------------------------------------------------------------------------
-- documents — uploaded by the person (status Pending until HR verifies)
-- or issued by HR (offer letter, agreement…; status Issued)
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  kind text not null check (kind in ('identity', 'student_id', 'resume', 'offer_letter', 'agreement', 'other')),
  title text not null,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes integer,
  status text not null default 'Pending' check (status in ('Pending', 'Verified', 'Rejected', 'Issued')),
  rejection_reason text,
  uploaded_by uuid references public.people (id) on delete set null,
  verified_by uuid references public.people (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists documents_person_id_idx on public.documents (person_id);

-- ---------------------------------------------------------------------------
-- tasks — richer workflow + submissions history
-- status: Assigned → In Progress → Submitted → (Revision Requested ↺) → Approved
-- ---------------------------------------------------------------------------
alter table public.intern_tasks add column if not exists estimated_hours numeric;
alter table public.intern_tasks add column if not exists resource_url text;
alter table public.intern_tasks add column if not exists updated_at timestamptz default now();

create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.intern_tasks (id) on delete cascade,
  submitted_by uuid not null references public.people (id) on delete cascade,
  note text,
  link_url text,
  file_path text,
  file_name text,
  review_status text not null default 'Pending' check (review_status in ('Pending', 'Approved', 'Revision Requested')),
  feedback text,
  reviewed_by uuid references public.people (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists task_submissions_task_id_idx on public.task_submissions (task_id);

-- ---------------------------------------------------------------------------
-- attendance — one row per person per day (self check-in upserts on it)
-- ---------------------------------------------------------------------------
do $$ begin
  alter table public.attendance add constraint attendance_person_date_key unique (person_id, date);
exception when duplicate_object or duplicate_table then null; end $$;

create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  date date not null,
  requested_check_in time,
  requested_check_out time,
  reason text not null,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  decided_by uuid references public.people (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index if not exists attendance_corrections_person_idx on public.attendance_corrections (person_id);

create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  date date not null,
  hours numeric not null check (hours > 0 and hours <= 24),
  summary text not null,
  created_at timestamptz not null default now()
);
create index if not exists work_logs_person_date_idx on public.work_logs (person_id, date desc);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- HR / admin requests raised by anyone
-- ---------------------------------------------------------------------------
create table if not exists public.hr_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  category text not null,
  subject text not null,
  details text,
  status text not null default 'Open' check (status in ('Open', 'Resolved', 'Declined')),
  response text,
  decided_by uuid references public.people (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists hr_requests_person_idx on public.hr_requests (person_id);

-- ---------------------------------------------------------------------------
-- Self check-in / check-out. Security definer so people can record their own
-- attendance without being able to write arbitrary statuses. Times are IST.
-- Late after 10:00. Re-checking in the same day is a no-op.
-- ---------------------------------------------------------------------------
create or replace function public.self_check_in() returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_person_id();
  now_ist timestamp := (now() at time zone 'Asia/Kolkata');
  rec public.attendance;
begin
  if me is null then raise exception 'not an approved person'; end if;
  insert into public.attendance (person_id, date, check_in, status, method)
  values (me, now_ist::date, now_ist::time(0),
          case when now_ist::time > time '10:00' then 'Late' else 'Present' end,
          'Self Check-in')
  on conflict (person_id, date) do update
    set check_in = coalesce(public.attendance.check_in, excluded.check_in),
        status = case when public.attendance.status in ('Absent') then excluded.status else public.attendance.status end
  returning * into rec;
  return rec;
end $$;

create or replace function public.self_check_out() returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_person_id();
  now_ist timestamp := (now() at time zone 'Asia/Kolkata');
  rec public.attendance;
begin
  if me is null then raise exception 'not an approved person'; end if;
  update public.attendance
    set check_out = now_ist::time(0),
        working_hours = round(extract(epoch from (now_ist::time(0) - check_in)) / 3600.0, 2)
  where person_id = me and date = now_ist::date and check_in is not null
  returning * into rec;
  if rec.id is null then raise exception 'check in first'; end if;
  return rec;
end $$;

revoke all on function public.self_check_in() from public, anon;
revoke all on function public.self_check_out() from public, anon;
grant execute on function public.self_check_in() to authenticated;
grant execute on function public.self_check_out() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.documents enable row level security;
alter table public.task_submissions enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.work_logs enable row level security;
alter table public.holidays enable row level security;
alter table public.hr_requests enable row level security;

revoke all on public.documents, public.task_submissions, public.attendance_corrections,
  public.work_logs, public.holidays, public.hr_requests from anon;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and policyname like 'p2_%' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- documents: HR manages; people see their own. Uploads go through the server.
create policy p2_documents_admin on public.documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p2_documents_own on public.documents for select to authenticated
  using (person_id = public.current_person_id());

-- task submissions: the intern submits on their own tasks; mentors review mentees
create policy p2_subs_admin on public.task_submissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p2_subs_read on public.task_submissions for select to authenticated
  using (
    submitted_by = public.current_person_id()
    or public.is_mentor_of(submitted_by)
  );
create policy p2_subs_submit on public.task_submissions for insert to authenticated
  with check (
    submitted_by = public.current_person_id()
    and review_status = 'Pending' and reviewed_by is null
    and exists (select 1 from public.intern_tasks t where t.id = task_id and t.intern_id = public.current_person_id())
  );
create policy p2_subs_mentor_review on public.task_submissions for update to authenticated
  using (public.is_mentor_of(submitted_by)) with check (public.is_mentor_of(submitted_by));

-- mentors may move their mentees' task status (approve / request revision)
create policy p2_tasks_mentor_update on public.intern_tasks for update to authenticated
  using (public.is_mentor_of(intern_id)) with check (public.is_mentor_of(intern_id));

-- attendance corrections: request your own; HR decides
create policy p2_corr_admin on public.attendance_corrections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p2_corr_read on public.attendance_corrections for select to authenticated
  using (person_id = public.current_person_id());
create policy p2_corr_request on public.attendance_corrections for insert to authenticated
  with check (person_id = public.current_person_id() and status = 'Pending' and decided_by is null);

-- work logs: your own, fully; mentors and HR read
create policy p2_logs_admin on public.work_logs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p2_logs_own on public.work_logs for all to authenticated
  using (person_id = public.current_person_id()) with check (person_id = public.current_person_id());
create policy p2_logs_mentor on public.work_logs for select to authenticated
  using (public.is_mentor_of(person_id));

-- holidays: everyone signed in reads; HR edits
create policy p2_holidays_admin on public.holidays for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p2_holidays_read on public.holidays for select to authenticated
  using (public.current_person_id() is not null);

-- HR requests: raise and read your own; HR responds
create policy p2_hrreq_admin on public.hr_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p2_hrreq_read on public.hr_requests for select to authenticated
  using (person_id = public.current_person_id());
create policy p2_hrreq_raise on public.hr_requests for insert to authenticated
  with check (person_id = public.current_person_id() and status = 'Open' and decided_by is null);
