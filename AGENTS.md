# Ryan CRM agent handoff

The CRM is in `crm/`; the root package is a separate Ocean app. Read `crm/LOCAL_START.md` and `crm/docs/assistant-requirements.md` before working on the assistant integrations. Preserve the existing daily planner and signed WhatsApp bridge. Production data lives in Supabase; never run write-based integration tests there or regenerate the existing encryption key.

Use the existing checkout in isolated cloud tasks; do not create a worktree unless requested. Run type checks and unit tests from crm, then build with no concurrent dev process. Local startup: `node crm/scripts/local/run.mjs setup`, `doctor`, then `dev`. Never commit .env files, downloaded mailbox content, tokens, customer exports or deployment-output files.

Pending integrations are explicitly listed in LOCAL_START.md; their presence in documentation is not implementation. Google provider is Gmail/Google Calendar. Telegram is the requested employee input channel; Ryan sees all team updates. Pricing/budget notes are out of scope.
