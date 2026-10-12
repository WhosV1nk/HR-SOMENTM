-- =============================================================================
-- Phase 4 — internship completion, certificates, letters of recommendation
-- Run after 0001–0003. Safe to re-run.
-- =============================================================================

-- reviews can now be marked as midterm / final evaluations
alter table public.performance_reviews add column if not exists review_type text not null default 'monthly';
do $$ begin
  alter table public.performance_reviews add constraint performance_reviews_type_check
    check (review_type in ('monthly', 'midterm', 'final'));
exception when duplicate_object then null; end $$;

-- who may give the final approval that issues a certificate (founders by default)
alter table public.people add column if not exists can_issue_certificates boolean not null default false;
update public.people set can_issue_certificates = true
where employment_type = 'Founder' and access_role = 'admin' and not can_issue_certificates;

-- issued PDFs are stored as documents
alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents add constraint documents_kind_check
  check (kind in ('identity', 'student_id', 'resume', 'offer_letter', 'agreement', 'certificate', 'recommendation', 'other'));

-- ---------------------------------------------------------------------------
-- certificates — one record per completed internship
-- Draft → Pending Approval → Issued (→ Revoked)
-- ---------------------------------------------------------------------------
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  code text not null unique,                       -- public verification code
  status text not null default 'Draft' check (status in ('Draft', 'Pending Approval', 'Issued', 'Revoked')),

  -- what the certificate states (frozen at issue time)
  full_name text not null,
  role text not null,
  department text not null,
  start_date date,
  end_date date,
  final_score numeric,
  grade text,

  -- letter of recommendation (optional)
  include_lor boolean not null default false,
  lor_text text,
  signatory_name text,
  signatory_title text,

  prepared_by uuid references public.people (id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references public.people (id) on delete set null,
  issued_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,

  certificate_doc_id uuid references public.documents (id) on delete set null,
  lor_doc_id uuid references public.documents (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists certificates_person_idx on public.certificates (person_id);
-- at most one live (non-revoked) certificate per person
create unique index if not exists certificates_one_live_per_person
  on public.certificates (person_id) where status <> 'Revoked';

alter table public.certificates enable row level security;
revoke all on public.certificates from anon;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and policyname like 'p4_%' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy p4_certificates_admin on public.certificates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- the intern sees their own record's status and, once issued, the files
create policy p4_certificates_own on public.certificates for select to authenticated
  using (person_id = public.current_person_id());
-- public verification (/verify/<code>) reads through the server's service role,
-- returning only name, role, dates, grade and validity
