-- =============================================================================
-- Remove pre-existing "allow everyone" policies.
--
-- Postgres combines policies with OR, so an older permissive policy (e.g. the
-- dashboard's "Enable read access for all users") keeps a table open no matter
-- what the Phase 1 policies say. After Phase 1, `people` and
-- `onboarding_tokens` were still readable with the public key.
--
-- This drops every policy on the app's tables that isn't one of ours
-- (prefix p1_ / p2_ …). To see what will go first, run just this query:
--
--   select tablename, policyname, roles, cmd, qual
--   from pg_policies where schemaname = 'public' and policyname !~ '^p[0-9]+_'
--   order by tablename;
--
-- Safe to re-run.
-- =============================================================================
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and policyname !~ '^p[0-9]+_'
      and tablename in (
        'people', 'attendance', 'leave_requests', 'intern_tasks', 'performance_reviews',
        'notifications', 'onboarding_tokens', 'onboarding_submissions', 'audit_log',
        'employees', 'interns', 'employee_reports', 'intern_attendance'
      )
  loop
    raise notice 'dropping policy % on %', r.policyname, r.tablename;
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- belt and braces: the anonymous role gets no table privileges at all
revoke all on public.people, public.attendance, public.leave_requests, public.intern_tasks,
  public.performance_reviews, public.notifications, public.onboarding_tokens,
  public.onboarding_submissions, public.audit_log, public.employees, public.interns,
  public.employee_reports, public.intern_attendance
from anon;
