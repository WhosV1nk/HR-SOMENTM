-- =============================================================================
-- Phase 5 — Internship Openings, Shareable Application Links & CV/Resume Submissions
-- Safe to re-run.
-- =============================================================================

-- 1. internship_openings: Openings created by HR with unique shareable links
create table if not exists public.internship_openings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  department text not null,
  cohort text default 'Summer 2026',
  duration text default '3 Months',
  location text default 'Remote',
  stipend text default 'Paid',
  description text not null,
  requirements text,
  perks text,
  status text not null default 'Active' check (status in ('Active', 'Closed', 'Draft')),
  created_by uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internship_openings_slug_idx on public.internship_openings (slug);
create index if not exists internship_openings_status_idx on public.internship_openings (status);

-- 2. internship_applications: Candidate submissions with CV/resume files
create table if not exists public.internship_applications (
  id uuid primary key default gen_random_uuid(),
  opening_id uuid not null references public.internship_openings (id) on delete cascade,
  application_no text unique not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  university text,
  degree text,
  graduation_year text,
  gpa text,
  linkedin_url text,
  github_url text,
  portfolio_url text,
  cover_note text,
  resume_file_path text not null,
  resume_file_name text not null,
  resume_file_size integer,
  resume_mime_type text,
  status text not null default 'New' check (status in ('New', 'Reviewing', 'Shortlisted', 'Interviewed', 'Offered', 'Rejected', 'Hired')),
  reviewer_notes text,
  reviewed_by uuid references public.people (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists internship_applications_opening_id_idx on public.internship_applications (opening_id);
create index if not exists internship_applications_email_idx on public.internship_applications (email);
create index if not exists internship_applications_status_idx on public.internship_applications (status);

-- Enable RLS
alter table public.internship_openings enable row level security;
alter table public.internship_applications enable row level security;

-- Drop previous policies if re-running
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and policyname like 'p5_%' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Policies for openings
create policy p5_openings_admin on public.internship_openings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy p5_openings_public on public.internship_openings for select to anon, authenticated
  using (status = 'Active');

-- Policies for applications
create policy p5_applications_admin on public.internship_applications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy p5_applications_public_insert on public.internship_applications for insert to anon, authenticated
  with check (true);
