# Daily planner release

Replaces the default landing flow with the photographed WEEKLY TO DO: Monday–Sunday, Make Appointment, Planning, Review, Preparation and Service. A task records a named person, planned stage and original plan separately from status/result. Recruitment is a planned stage, not a new client card. The existing client pipeline remains available and is never advanced by task completion.

Agents open `/today`; managers open `/review` and can inspect each agent's week read-only. Secondary tools remain under More. WhatsApp accepts multiple tasks, previews each before confirmation and uses exact owner/date/category/name matching for updates. Ambiguous updates request clarification. Updates retain the original plan. The task batch RPC is atomic, checks row versions and uses a draft receipt to make retries idempotent.

## Resume verification — 2026-10-24

The desktop session added the signed WhatsApp bridge integration and database protections. This resume adds `tasks_status`, which reports saved only when the atomic database receipt exists, plus complete planner command metadata. An applied draft alone is not proof that its tasks were saved.

Validation: 62 unit tests, TypeScript checks and the Next.js production build pass under Node. Disposable PGlite checks pass for all six migrations, owner isolation, inactive accounts, atomic task batches, retries and immutable original plans. These checks do not establish production persistence or handset delivery.

## Release gate

PR #1 remains a draft. Verify production schema against migration 0006 and test the authenticated planner endpoint before merging and enabling the planner instructions below. Do not rerun migration 0006 blindly: the desktop session already submitted it. Do not alter production permissions or security settings from a WhatsApp session. No third-party messages were sent by this resume.

## WhatsApp planner instructions for activation after deployment

Call `schema` first. If its actions omit tasks_prepare, the planner is not deployed: explain that limitation. Keep existing client management behavior.

For daily plans, use tasks_prepare with tasks containing operation, day (Hong Kong YYYY-MM-DD), category, stage, name, plan, status and result. Show the returned preview and retain draft_id. This prepares a draft only; it does not save tasks. Wait for explicit confirmation before tasks_confirm. Use tasks_cancel when the sender cancels the draft.

For results, read tasks_list first and match the original day/category/name/stage. Preserve original plan; change only status/result. Ask when multiple tasks match. Ryan can review team tasks through tasks_list and resolve staff names through staff; task writes remain the sender's own.

After an uncertain confirmation, call tasks_status with the same draft_id. Only saved:true proves a receipt exists. If status is unconfirmed, retry tasks_confirm with that same draft_id after checking the sender's previous explicit confirmation. Never create a replacement draft merely because a confirmation timed out. A pending or cancelled draft is not saved. Task completion never advances the client pipeline.

## Limits

Review totals and overdue counts refer to the selected week. Moving an appointment requires cancelling the old plan and adding a new dated task so its original plan remains reviewable. Task-only messages do not update client details or activity scores. Speech/audio handling is unchanged.
