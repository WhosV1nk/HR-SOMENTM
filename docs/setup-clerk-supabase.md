# Phase 1 go-live: approved logins + database security

Do these **in order, before** pushing the Phase 1 code to `main` (which deploys
to production). Steps 1–3 are harmless to the current live site.

## 1. Let Supabase trust Clerk logins

1. **Clerk Dashboard** → *Integrations* → **Supabase** → *Activate Supabase integration*.
   Copy the **Clerk domain** it shows (e.g. `clerk.somentm.com`).
   This adds `role: authenticated` to Clerk session tokens.
2. **Supabase Dashboard** → *Authentication* → *Sign In / Providers* →
   **Third-Party Auth** → *Add provider* → **Clerk** → paste the domain → save.

## 2. Run the migration

Supabase Dashboard → *SQL Editor* → *New query* → paste the whole of
`supabase/migrations/20261012000001_phase1_access_control.sql` → **Run**.

It is safe to run twice. It:
- adds `people.clerk_user_id` and `people.access_role` (`admin` | `member`)
- makes every **Founder** an `admin`
- lower-cases stored emails (logins are matched case-insensitively)
- fixes `leave_requests` (adds `person_id`, `reason`, decision fields)
- creates `audit_log`
- **turns on Row Level Security on every table**, so the public key can no
  longer read anything

## 3. Check your own admin access

Your login email must exactly match a People record whose type is Founder, or
whose `access_role` you set to `admin`:

```sql
select email, employment_type, status, access_role from people order by access_role, email;
```

To make someone else an admin:

```sql
update people set access_role = 'admin' where email = 'name@somentm.com';
```

## 4. (Optional) Stop strangers creating Clerk accounts at all

The app already refuses anyone whose email is not in People. To also stop them
**signing up**: Clerk Dashboard → *Configure* → *Restrictions* → turn on
**Allowlist** (availability depends on your Clerk plan). The app keeps that
list in sync automatically: adding a person allows their email, and
deactivating them removes it.

Existing People were added before this sync existed. Add their emails to the
allowlist once by hand, or they won't be able to sign up.

## 5. Push the code

`git push` to `main`. Vercel deploys it. Then sign in and confirm:
- you land on the HR dashboard
- an email that isn't in People gets the **"Not on the list"** screen
- *Audit log* (sidebar → System) shows `account.linked` for your first sign-in

## Local development

`.env.local` currently holds **production** Clerk keys, which Clerk only
accepts on `somentm.com`, so sign-in can't load on `localhost`. For local work,
create a Clerk **development** instance and use its `pk_test_…` / `sk_test_…`
keys locally. Repeat step 1 for that instance as well.
