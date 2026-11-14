# AUREVIA GED Academy — Product Roadmap

## Product identity
- Public brand: AUREVIA GED Academy
- Languages: English and Dari (Persian-script Dari), with right-to-left layout for Dari
- Visual identity: deep navy, champagne gold and warm ivory
- Public learning catalogue: published GED subjects and lessons are readable without an account
- AUREVIA is an independent GED preparation platform and is not affiliated with GED Testing Service.

## Implemented foundations
- Rebranded public site and workspace from RU'YA to AUREVIA
- Added original SVG emblem and updated metadata/favicon
- Added language switching, Dari typography and RTL layout support
- Added public GED subject catalogue with the four current test subjects
- Seeded 13 original bilingual starter lessons
- Added separate question and answer-key tables so public questions do not expose answer keys
- Added schema for exam attempts and learner responses
- Added community chat table with Realtime publication
- Added fee invoices and student payment submissions with management verification
- Added in-app notifications, notification preferences and bilingual notification templates
- Added a 15-minute Supabase Cron job for daily homework, weekly class and monthly fee reminders
- Added foreign-key indexes and tightened anonymous database grants

## GED subject catalogue
The initial subject catalogue follows the current GED international curriculum categories and test durations:
- Mathematical Reasoning — 115 minutes
- Reasoning Through Language Arts — 150 minutes
- Social Studies — 70 minutes
- Science — 90 minutes

The uploaded *1,001 GED Practice Questions For Dummies* book is a reference for identifying practice areas and question styles. It is not to be republished or copied into the public library without permission. AUREVIA lessons and questions must be original, public-domain or properly licensed.

## Remaining work before public launch
1. Build a complete lesson-progress tracker and student study plan.
2. Build the timed practice-exam interface and secure server-side grading.
3. Add teacher/management tools for publishing bilingual lessons and question sets.
4. Add secure file upload and a public-resource storage workflow for licensed materials.
5. Complete student/teacher/management end-to-end testing with test accounts.
6. Add email delivery and optional push notifications for users who opt in.
7. Choose and configure the live-class provider (embedded Jitsi or a selected meeting service).
8. Review fee currency, payment channels, receipts and local operating policies.
9. Test the full English/Dari interface on mobile and desktop before merging to the live site.

## Current operational notes
- The notification scheduler creates in-app reminders. Browser alerts work while the site is open and permission has been granted. Email delivery is not connected yet.
- Live-class records already support meeting URLs. The current workspace opens those links; embedded video requires a selected provider and configuration.
- The public catalogue is live in the database, but only published lessons/resources appear to visitors.
