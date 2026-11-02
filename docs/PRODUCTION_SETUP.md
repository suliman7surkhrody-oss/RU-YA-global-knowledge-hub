# RU'YA platform — production activation

The repository now contains the first production backend foundation. The public website is still hosted on GitHub Pages; authentication and private academic data are provided by Supabase.

## 1. Create the backend

1. Create a Supabase project owned by RU'YA (not a personal test project).
2. Choose a strong database password and keep it in the organization's password manager.
3. In **SQL Editor**, run `supabase/migrations/20261102000100_initial_platform.sql`.
4. In **Project Settings → API**, copy the Project URL and anon/publishable key.
5. Put those two public values in `js/supabase-config.js`. Never use the service-role key in the browser or commit it to Git.
6. The migration creates the **private** `ruya-private` Storage bucket and role-scoped policies for learner submissions and staff library uploads. Verify these policies in Supabase Storage before uploading real student records.
7. Add the deployed GitHub Pages URL to Supabase **Authentication → URL Configuration → Site URL** and allowed redirect URLs.

## 2. First management account

Public registration always creates a **student** account. It cannot choose teacher or management access. This is intentional.

1. Register the organization's designated administrator using the portal.
2. Confirm the email if email confirmation is enabled.
3. In Supabase SQL Editor, assign management access to that exact account:

```sql
update public.profiles
set role = 'management'
where lower(email) = lower('ADMIN_EMAIL_CONFIRMED_BY_RUYA');
```

Replace the example with the approved administrator email. Verify the row before proceeding. Do not promote an account without the organization's authorization.

Management can then assign teacher roles and activate staff accounts. Do not share administrator credentials.

## 3. Authentication and mail

- Configure SMTP in Supabase Auth before inviting real learners; the default email service is rate-limited.
- Enable email confirmation.
- Set a clear password policy and review session settings.
- Test sign-up, confirmation, sign-in, sign-out, password reset and disabled-account handling.
- Use a RU'YA-controlled sender domain and verified email provider.

## 4. Data protection and operations

- Keep RLS enabled on every table. The migration includes role-aware policies; review them with the institution before real data is loaded.
- Never expose a Supabase service-role key in HTML, JavaScript, GitHub Pages, or browser storage.
- Use the private storage bucket for submissions and internal documents only after policies are approved.
- Configure automated database backups and test restoration.
- Restrict management access to named authorized staff; enable MFA for administrators.
- Publish a privacy notice, retention schedule, acceptable-use policy and support contact before student onboarding.
- Obtain institutional approval for student data, course catalogues, staff lists, logo, public claims and any third-party integrations.

## 5. Current implementation status

| Area | Status |
|---|---|
| Public website and responsive design | Live preview |
| Database schema and row-level security | Migration prepared; must be applied to RU'YA's Supabase project |
| Browser authentication client | Ready for project URL/key |
| Real user accounts | Authentication UI is implemented; requires Supabase project activation and email configuration |
| Courses, sections, enrollments, sessions | Live portal workflows implemented; requires database activation |
| Attendance, assignments, submissions, grading | Live portal workflows implemented; requires database activation and end-to-end testing |
| Library, announcements, messages | Live portal workflows implemented; requires database activation and end-to-end testing |
| Private file uploads | Assignment and library uploads with short-lived signed downloads; verify storage policies and file limits before launch |
| Production launch | Not approved until security, legal, data and operational checks are complete |

GitHub Pages is a static host. It must not be treated as a trusted server or used to store secrets. The Supabase database policies are the security boundary for browser requests.
