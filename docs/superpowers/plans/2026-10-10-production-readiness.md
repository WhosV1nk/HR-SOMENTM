# Production Readiness & Shipping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the SOMENTM HR & People Operations portal into an end-to-end production-ready system with unified database queries, live notifications, real settings, document verification workflows, and deployment configuration.

**Architecture:** Next.js 16 App Router backed by Supabase with Row Level Security (RLS) and Clerk authentication. Single source of truth around the unified `people` table, with real-time audit notifications, document status transitions, and zero legacy schema dependencies.

**Tech Stack:** Next.js 16 (Turbopack), React 19, TypeScript 5, Tailwind CSS 4, Supabase (`@supabase/ssr`), Clerk (`@clerk/nextjs`), Resend, Lucide Icons.

**Spec:** SOMENTM HR & People Operations Enterprise Requirements

## Global Constraints

- Never use legacy tables (`employees`, `employee_reports`, `intern_attendance`). All modules reference `people`, `attendance`, `leave_requests`, `intern_tasks`, `performance_reviews`, `notifications`, `onboarding_tokens`, `onboarding_submissions`.
- Never expose sensitive keys (`SUPABASE_SECRET_KEY`, `CLERK_SECRET_KEY`, `RESEND_API_KEY`) to the client.
- Always use `adminSupabase` for server actions requiring elevated permissions.
- In Next.js 15/16, always `await auth()` and `await cookies()`.
- Brand name: Always capitalized `SOMENTM`.

---

### Task 1: Unify Reports Module with the People Architecture

**Files:**
- Modify: `d:/somentm-employee-management/app/reports/page.tsx`
- Test: `cmd.exe /c "npm run build"`

**Interfaces:**
- Consumes: `supabase.from("people")`, `supabase.from("performance_reviews")`
- Produces: Performance review reports tied to unified `people` table IDs

- [ ] **Step 1: Inspect legacy dependencies in Reports**
Verify `employees` and `employee_reports` tables are no longer referenced in `app/reports/page.tsx`.

- [ ] **Step 2: Rewrite `app/reports/page.tsx` to use unified `people` and `performance_reviews`**
Replace queries and server actions with `people` and `performance_reviews`.

- [ ] **Step 3: Verify build passes cleanly**
Run `cmd.exe /c "npm run build"`.

---

### Task 2: Live Notifications Bell & Popover Drawer

**Files:**
- Modify: `d:/somentm-employee-management/components/notifications-bell.tsx`
- Create: `d:/somentm-employee-management/components/notifications-drawer.tsx`
- Test: `cmd.exe /c "npm run build"`

**Interfaces:**
- Consumes: `notifications` table (`title`, `message`, `type`, `read`, `created_at`)
- Produces: Interactive notification drawer with unread count badge and mark-as-read action

- [ ] **Step 1: Create client-side notifications drawer with DB polling/fetch**
Build popover drawer listing recent system alerts (onboarding submissions, leave requests, attendance events).

- [ ] **Step 2: Wire up mark-as-read server action**
Implement server action updating `read: true` for notifications.

- [ ] **Step 3: Update `components/notifications-bell.tsx` to open drawer**
Connect drawer toggle to bell button with live unread indicator.

- [ ] **Step 4: Verify build**
Run `cmd.exe /c "npm run build"`.

---

### Task 3: HR Document Verification & Status Workflow

**Files:**
- Modify: `d:/somentm-employee-management/app/people/[id]/page.tsx`
- Test: `cmd.exe /c "npm run build"`

**Interfaces:**
- Consumes: `onboarding_submissions` (`identity_doc_status`, `student_id_doc_name`, `rejection_reason`)
- Produces: HR actions to Approve or Reject submitted documents with reason notes

- [ ] **Step 1: Add HR document approval & rejection actions**
Implement server actions `verifyDocumentAction` and `rejectDocumentAction`.

- [ ] **Step 2: Add Document Review UI card in Profile**
Display submitted identity proof and student ID with "Verify Document" / "Reject with Reason" buttons for HR.

- [ ] **Step 3: Connect document status to Onboarding Checklist**
Ensure `Identity proof verified by HR` checklist item requires `identity_doc_status === 'Verified'`.

- [ ] **Step 4: Verify build**
Run `cmd.exe /c "npm run build"`.

---

### Task 4: Real Organization & Attendance Policies in Settings

**Files:**
- Modify: `d:/somentm-employee-management/app/settings/page.tsx`
- Test: `cmd.exe /c "npm run build"`

**Interfaces:**
- Consumes: Config settings (working hours, grace period, notification email sender)
- Produces: Policy display and working hour threshold management

- [ ] **Step 1: Replace placeholder cards with working policy settings**
Add operational details: working hours threshold (09:00 AM check-in, late after 10:00 AM), departments list, attendance status policies.

- [ ] **Step 2: Add Clerk user management quick links and documentation**
Provide direct links to Clerk user role administration and Supabase configuration.

- [ ] **Step 3: Verify build**
Run `cmd.exe /c "npm run build"`.

---

### Task 5: Production Build Verification & Clean-up

**Files:**
- Modify: `.env.example` (ensure created for deployment docs)
- Test: Full build, route verification, and asset check

- [ ] **Step 1: Create `.env.example` template**
Document required environment variables for production deployment.

- [ ] **Step 2: Verify all assets in `public/`**
Confirm `somentm-logo.png` renders on all views.

- [ ] **Step 3: Run full production build**
Run `cmd.exe /c "npm run build"` and verify exit code 0 with all routes prerendered/dynamic as expected.
