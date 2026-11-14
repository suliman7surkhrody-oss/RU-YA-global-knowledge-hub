# AUREVIA GED Academy

The AUREVIA repository contains the public institutional website and the evolving role-based learning platform.

## Included
- Responsive public institutional website.
- Supabase email/password authentication client, account registration, email confirmation flow, password reset and sign-out.
- Student, teacher and management workspaces with role-based navigation.
- Live academic workflows for course catalogue, class sections, class-session scheduling, student enrollment, assignments, learner submissions, grading, attendance, learning resources, announcements and private messages.
- PostgreSQL migration with row-level security, safe student-first account provisioning and a role-scoped messaging directory.
- Production activation and security checklist in [docs/PRODUCTION_SETUP.md](docs/PRODUCTION_SETUP.md).

## Deployment and activation
The public website is hosted on GitHub Pages. Authentication and private academic records require an AUREVIA-owned Supabase project. Apply [the database migration](supabase/migrations/20261102000100_initial_platform.sql), configure [the browser project settings](js/supabase-config.js), and follow [the production setup guide](docs/PRODUCTION_SETUP.md).

## Security
New public registrations are students only. Teacher and management permissions must be assigned by authorized management. Row-level security restricts data access by role and class assignment. Do not enter real student or staff information until the AUREVIA-owned backend is configured, email delivery is secured, policies are reviewed and backups are enabled.

Never place a Supabase service-role key, database password or other server secret in this repository or browser code. The anon/publishable key is designed for browser use only when row-level security is correctly configured.

WordUp English remains a separate platform; any future integration should use an authenticated, documented API.
