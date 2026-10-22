# Daily planner release

Replaces the default landing flow with the photographed WEEKLY TO DO: Monday–Sunday, Make Appointment, Planning, Review, Preparation and Service. A task records a named person, planned stage and original plan separately from status/result. Recruitment is a planned stage, not a new client card. The existing client pipeline remains available and is never advanced by task completion.

Agents open `/today`; managers open `/review` and can inspect each agent's week read-only. Secondary tools remain under More. WhatsApp accepts multiple tasks, previews each before confirmation and uses exact owner/date/category/name matching for updates. Ambiguous updates request clarification. Updates retain the original plan. The task batch RPC is atomic, checks row versions and uses a draft receipt to make retries idempotent.

## Release requirements

This change is prepared for review, not deployed. Apply `supabase/migrations/0006_daily_tasks.sql` from an authorized terminal session before releasing the new code. It adds a table, owner-scoped RLS and service-only RPC; no production security settings were changed during the WhatsApp request.

Run `supabase/tests/daily_tasks_check.sql` on a disposable Supabase instance, then test two agents, an inactive agent and Ryan with real session isolation. Verify the existing Meta webhook and AI configuration with test messages and confirmation retries. Database tests and live WhatsApp delivery have not been run in this workspace. No third-party messages were sent.

## Validation

Node.js: all 40 unit tests pass and the Next.js production build passes. Browser fixture checks use the actual DailyPlanner component with mocked actions, not a connected database. They cover desktop/mobile layout, changing days and visible save errors. They do not establish end-to-end persistence or RLS behavior.

## Limits

Review totals and overdue counts refer to the selected week. Moving an appointment requires cancelling the old plan and adding a new dated task so its original plan remains reviewable. Task-only messages do not update client details or activity scores; submit detailed client notes separately. Speech/audio handling is unchanged.
