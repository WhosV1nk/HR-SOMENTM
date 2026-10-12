-- =============================================================================
-- Phase 1 — access control, approved-email login, schema fixes, audit log
--
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: every statement is idempotent.
--
-- Prerequisite for the RLS policies to admit anyone: Clerk must be added as a
-- third-party auth provider in Supabase (see docs/setup-clerk-supabase.md).
-- Until then, signed-in requests are rejected by the database (fail closed).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. people: link to Clerk + portal role, normalised emails
-- ---------------------------------------------------------------------------
alter table public.people add column if not exists clerk_user_id text;
alter table public.people add column if not exists access_role text not null default 'member';

do $$ begin
  alter table public.people add constraint people_access_role_check check (access_role in ('admin', 'member'));
exception when duplicate_object then null; end $$;

create unique index if not exists people_clerk_user_id_key on public.people (clerk_user_id) where clerk_user_id is not null;

-- emails are matched against the signed-in Clerk address, so store them lower-case
update public.people set email = lower(trim(email)) where email <> lower(trim(email));
do $$ begin
  alter table public.people add constraint people_email_lowercase check (email = lower(email));
exception when duplicate_object then null; end $$;

-- founders start as admins; change others in People → profile later
update public.people set access_role = 'admin'
where employment_type = 'Founder' and access_role <> 'admin';

-- ---------------------------------------------------------------------------
-- 2. leave_requests: the app writes person_id / reason, which didn't exist
-- ---------------------------------------------------------------------------
alter table public.leave_requests add column if not exists person_id uuid references public.people (id) on delete cascade;
alter table public.leave_requests add column if not exists reason text;
alter table public.leave_requests add column if not exists decided_by uuid references public.people (id) on delete set null;
alter table public.leave_requests add column if not exists decided_at timestamptz;
alter table public.leave_requests add column if not exists decision_note text;
create index if not exists leave_requests_person_id_idx on public.leave_requests (person_id);

-- ---------------------------------------------------------------------------
-- 3. small gaps the UI already relies on
-- ---------------------------------------------------------------------------
alter table public.onboarding_submissions add column if not exists student_id_doc_name text;
alter table public.notifications add column if not exists person_id uuid references public.people (id) on delete cascade;
create index if not exists notifications_person_id_idx on public.notifications (person_id);

create index if not exists attendance_person_id_idx on public.attendance (person_id);
create index if not exists intern_tasks_intern_id_idx on public.intern_tasks (intern_id);
create index if not exists performance_reviews_person_id_idx on public.performance_reviews (person_id);
create index if not exists people_mentor_id_idx on public.people (mentor_id);

-- ---------------------------------------------------------------------------
-- 4. audit log — who did what, written server-side only
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.people (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- 5. identity helpers for RLS (Clerk user id arrives as the JWT `sub`)
-- ---------------------------------------------------------------------------
create or replace function public.current_person_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.people
  where clerk_user_id = (select auth.jwt() ->> 'sub')
    and status <> 'Terminated'
  limit 1
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.people
    where clerk_user_id = (select auth.jwt() ->> 'sub')
      and access_role = 'admin'
      and status = 'Active'
  )
$$;

-- true when the signed-in person is the assigned mentor of `p`
create or replace function public.is_mentor_of(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.people
    where id = p and mentor_id is not null and mentor_id = public.current_person_id()
  )
$$;

-- the signed-in person's own mentor (helper avoids a recursive policy on people)
create or replace function public.current_mentor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select mentor_id from public.people where id = public.current_person_id()
$$;

revoke all on function public.current_person_id() from public, anon;
revoke all on function public.current_mentor_id() from public, anon;
grant execute on function public.current_mentor_id() to authenticated;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_mentor_of(uuid) from public, anon;
grant execute on function public.current_person_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_mentor_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Row Level Security — nothing is readable with the public key alone
-- ---------------------------------------------------------------------------
alter table public.people enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;
alter table public.intern_tasks enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.onboarding_tokens enable row level security;
alter table public.onboarding_submissions enable row level security;
alter table public.audit_log enable row level security;
-- legacy tables (empty, superseded by `people`): locked, no policies
alter table public.employees enable row level security;
alter table public.interns enable row level security;
alter table public.employee_reports enable row level security;
alter table public.intern_attendance enable row level security;

-- drop-then-create keeps the script re-runnable
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and policyname like 'p1_%' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- people: admins manage everyone; a person sees themself, their mentor and mentees
create policy p1_people_admin on public.people for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p1_people_read on public.people for select to authenticated
  using (
    id = public.current_person_id()
    or mentor_id = public.current_person_id()
    or id = public.current_mentor_id()
  );

-- attendance: admins manage; people and their mentors read
create policy p1_attendance_admin on public.attendance for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p1_attendance_read on public.attendance for select to authenticated
  using (person_id = public.current_person_id() or public.is_mentor_of(person_id));

-- leave: admins decide; people read theirs and may file a *pending* request
create policy p1_leave_admin on public.leave_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p1_leave_read on public.leave_requests for select to authenticated
  using (person_id = public.current_person_id() or public.is_mentor_of(person_id));
create policy p1_leave_request on public.leave_requests for insert to authenticated
  with check (person_id = public.current_person_id() and status = 'Pending' and decided_by is null);

-- tasks: admins manage; interns and their mentors read
create policy p1_tasks_admin on public.intern_tasks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p1_tasks_read on public.intern_tasks for select to authenticated
  using (intern_id = public.current_person_id() or public.is_mentor_of(intern_id));

-- reviews: admins write; the person can read (never edit) their own scores
create policy p1_reviews_admin on public.performance_reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p1_reviews_read on public.performance_reviews for select to authenticated
  using (person_id = public.current_person_id() or public.is_mentor_of(person_id));

-- notifications: person-addressed rows go to that person; null person_id = HR feed
create policy p1_notifications_admin on public.notifications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p1_notifications_own on public.notifications for select to authenticated
  using (person_id = public.current_person_id());
create policy p1_notifications_mark_read on public.notifications for update to authenticated
  using (person_id = public.current_person_id()) with check (person_id = public.current_person_id());

-- onboarding: the public token page uses the server's service role; HR reviews
create policy p1_tokens_admin on public.onboarding_tokens for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p1_submissions_admin on public.onboarding_submissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy p1_submissions_own on public.onboarding_submissions for select to authenticated
  using (person_id = public.current_person_id());

-- audit log: read-only for admins; rows are written with the service role
create policy p1_audit_admin_read on public.audit_log for select to authenticated
  using (public.is_admin());
