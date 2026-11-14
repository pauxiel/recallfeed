# RecallFeed Review Handoff System

This directory implements a local, one-way review handoff from Kiro CLI to Firstmate supervisor for the RecallFeed project.

---

## Architecture

```
Kiro CLI (Implementation Agent)
    ↓ completes milestone
    ↓ writes immutable review request to .kiro/reviews/requests/
    ↓
PostTaskExec Hook (.kiro/hooks/notify-firstmate-review.json)
    ↓ triggers notify-firstmate.sh
    ↓ sends JSON notification via stdin
    ↓
Firstmate Inbox (fm-inbox.sh note --json)
    ↓ receives and stores notification
    ↓
Firstmate Supervisor (ChatGPT Astra with GPT-6 reasoning)
    ↓ reads handoff document
    ↓ evaluates against supervisor brief
    ↓ returns verdict: APPROVE | APPROVE WITH CONDITIONS | REQUEST CHANGES | BLOCK
    ↓
User
    ↓ reads Firstmate's feedback
    ↓ explicitly authorizes next steps
    ↓
[Kiro CLI proceeds only after authorization]
```

---

## Components

### 1. Custom Agent Configuration

**File:** `.kiro/agents/recallfeed.json`

- Configures Kiro CLI to follow RecallFeed supervisor brief
- Defines review gates (Gate 1-5)
- Documents stop boundaries at end of each gate
- Specifies security-first defaults and Skeleton Crew rules

**Note:** The agent profile specifies `model: claude-sonnet-4.5` for Kiro CLI. Firstmate's model (GPT-6 Astra with High reasoning) is controlled independently by Firstmate's own configuration.

### 2. Review Request Documents

**Location:** `.kiro/reviews/requests/`

Immutable handoff documents written by Kiro at milestone completion.

**Naming:** `YYYYMMDD-HHMMSS-phase.md`

**Format:** See `REVIEW-REQUEST-TEMPLATE.md` for complete specification

**Required Sections:**
- Review Request ID
- Project path and milestone
- Status (ready vs blocked)
- Files changed with specific paths
- What was actually done (concrete, not vague claims)
- Checks actually run with command output
- Remaining concerns (blockers, uncertainties, known issues)
- File integrity (SHA-256 hashes or commit ID)
- Acceptance criteria checklist
- Specific request for Firstmate

**Critical:** Do NOT include:
- Credentials, tokens, or secret URLs
- Private note content
- Full conversation transcripts

### 3. Notification Hook

**File:** `.kiro/hooks/notify-firstmate-review.json`

**Trigger:** PostTaskExec (fires after task completion)

**Action:** Executes `.kiro/hooks/scripts/notify-firstmate.sh`

**Behavior:**
- Finds the newest review request in `.kiro/reviews/requests/` **by file name** (names start with `YYYYMMDD-HHMMSS`). File modification times are not used, because a fresh checkout or worktree gives every file the same time and would pick an arbitrary request
- Refuses to announce a request that is not committed, or that has uncommitted edits, because only a committed request is immutable
- Checks if already submitted (via `.kiro/reviews/.last-submitted` marker)
- Generates unique request ID: `recallfeed-YYYYMMDD-HHMMSS-phase`
- Sends JSON notification to Firstmate inbox
- Marks as submitted on success
- Reports delivery result to stderr

**Idempotency:** Same request is NOT re-sent if already submitted. New requests trigger new notifications with unique IDs.

**Retry:** On delivery failure, the marker is NOT created, so the hook will retry on next PostTaskExec.

### 4. Notification Script

**File:** `.kiro/hooks/scripts/notify-firstmate.sh`

**Input:** None (discovers review requests from filesystem)

**Output:** JSON notification via stdin to `fm-inbox.sh note --json`

**Notification Format:**
```json
{
  "source": "kiro-cli",
  "project": "RecallFeed",
  "request_type": "review",
  "request_id": "recallfeed-YYYYMMDD-HHMMSS-phase",
  "handoff_path": ".kiro/reviews/requests/[filename].md",
  "timestamp": "2026-11-07T18:36:08Z",
  "message": "Kiro CLI has completed a RecallFeed milestone and requests read-only evaluation. Please review the immutable handoff document at: [path]"
}
```

**Firstmate Command** (run by the script; `FM_HOME` comes from local configuration, see below):
```bash
FM_HOME="$FM_HOME" "$FM_HOME/bin/fm-inbox.sh" note --json --request-id "$REQUEST_ID" -
```

**Local configuration (optional, never committed):** the script does nothing unless the supervisor
integration is configured, so building and testing never depend on it. Either export `FM_HOME`,
or put `FM_HOME=<path>` in `${XDG_CONFIG_HOME:-$HOME/.config}/recallfeed/firstmate.env`, a file
outside the repository. Do not put personal paths or credentials in tracked files.

**Workspace-aware payload:** the notification names the checkout the script ran in, which may be
an isolated git worktree and not the primary checkout. Fields added beyond the original format:
`workspace_path`, `isolated_workspace`, `primary_checkout_path`, `branch`, `commit` (HEAD),
`request_commit` (the commit that last changed the request file), and `request_sha256`. A reviewer
should read the request from `workspace_path`, at `commit`, and compare `request_sha256`.

**Dry run:** `bash .kiro/hooks/scripts/notify-firstmate.sh --dry-run` prints the notification and
sends nothing, writes no marker, and does not need `FM_HOME`.

**Exit Codes:**
- 0: Success (notification delivered or no new requests)
- 1: Delivery failed (will retry on next trigger)

---

## Usage

### For Kiro CLI

At the end of a milestone (e.g., completing Gate 1 specifications):

1. Write review request document to `.kiro/reviews/requests/YYYYMMDD-HHMMSS-phase.md`
2. Use the template format from `REVIEW-REQUEST-TEMPLATE.md`
3. Include all required sections with concrete evidence
4. Do NOT proceed to next gate
5. The PostTaskExec hook will automatically notify Firstmate

**Example:**
```bash
# Kiro completes Gate 1 specifications
# Kiro writes: .kiro/reviews/requests/20261107-183608-gate1-specs.md
# Hook automatically triggers and sends notification
# Kiro stops and waits for user authorization after review
```

### For User

After Firstmate review:

1. Read Firstmate's verdict and feedback
2. If APPROVE: Authorize Kiro to proceed to next gate
3. If REQUEST CHANGES: Provide revision instructions to Kiro
4. If BLOCK: Address blocking issues before any further work
5. Optionally move completed review to `.kiro/reviews/completed/`

### For Firstmate

Firstmate receives notification via inbox and:

1. Reads the immutable handoff document at specified path
2. Evaluates against supervisor brief criteria
3. Returns structured review verdict (see supervisor brief Section 15)
4. Does NOT automatically implement changes
5. Does NOT advance project phases

---

## Testing

### Smoke Test

A smoke test was conducted on 2026-11-07 18:36:08 UTC:

**Command:**
```bash
# from the checkout (or isolated workspace) that contains the committed request
bash .kiro/hooks/scripts/notify-firstmate.sh
```

**Result:**
```json
{
  "schema": "fm-inbox-note.v1",
  "outcome": "created",
  "id": "1794076611-x4xqxH",
  "request_id": "recallfeed-20261107-183608-smoke-test",
  "saved": true,
  "announced": true,
  "path": "/Users/paulobayuwana/Documents/projects/firstmate/state/inbox/1794076611-x4xqxH.note"
}
✓ Review request submitted to Firstmate: recallfeed-20261107-183608-smoke-test
```

**Verification:**
- ✓ Notification delivered successfully
- ✓ Unique request ID generated
- ✓ Marker file created at `.kiro/reviews/.last-submitted`
- ✓ Idempotency verified (second run did not send duplicate)
- ✓ Smoke test review request accessible at `.kiro/reviews/requests/20261107-183608-smoke-test.md`

**Note:** Successful submission does not yet prove Firstmate processed the notification. User should verify Firstmate acknowledgment separately.

---

## Constraints and Limitations

### What This System Does

- ✓ Automates notification delivery from Kiro to Firstmate
- ✓ Ensures immutable handoff documents
- ✓ Prevents duplicate notifications for same request
- ✓ Provides structured review request format
- ✓ Preserves one-way communication (Kiro → Firstmate)

### What This System Does NOT Do

- ✗ Automatically act on Firstmate feedback (user authorization required)
- ✗ Start implementation, advance phases, or deploy automatically
- ✗ Guarantee Firstmate processed the notification (delivery ≠ review)
- ✗ Configure Firstmate's model (controlled independently)
- ✗ Add servers, daemons, MCP services, or polling systems
- ✗ Invoke other Firstmate control commands besides `note`

### Known Uncertainties

1. **Firstmate processing:** Delivery confirmation (`saved: true, announced: true`) indicates the notification reached Firstmate's inbox, but does not confirm Firstmate has read or reviewed the document. User should verify Firstmate's response separately.

2. **Hook trigger timing:** PostTaskExec fires after task completion, but "task" boundaries depend on Kiro CLI's session management. May not fire after every response.

3. **Error recovery:** If `fm-inbox.sh` fails with a permanent error (not just temporary network issue), the hook will retry indefinitely on subsequent PostTaskExec triggers until manual intervention.

---

## Security and Privacy

### Handoff Document Safety

- Review requests must NOT contain credentials, tokens, or secret URLs
- Private note content must NOT be included in full
- Conversation transcripts should be summarized, not dumped verbatim
- File paths and hashes are safe to include
- Command output should be sanitized (no secrets in environment vars)

### Notification Safety

- Notifications use project-local paths only
- No evaluation of report text as shell commands
- No automatic code execution based on Firstmate feedback
- User authorization gate preserved

### Firstmate Inbox Access

- Direct filesystem access to Firstmate's inbox at: `/Users/paulobayuwana/Documents/projects/firstmate/state/inbox/`
- No network exposure, no remote API calls
- Single-user, local-only communication

---

## Maintenance

### Adding New Review Requests

1. Create new file in `.kiro/reviews/requests/` with format: `YYYYMMDD-HHMMSS-phase.md`
2. Follow template structure from `REVIEW-REQUEST-TEMPLATE.md`
3. Hook will detect and notify automatically on next PostTaskExec

### Manual Notification

If hook doesn't trigger, manually run:
```bash
# from the checkout (or isolated workspace) that contains the committed request
bash .kiro/hooks/scripts/notify-firstmate.sh
```

### Resetting Submission Tracker

To force re-notification of last request (e.g., after fixing delivery issue):
```bash
rm .kiro/reviews/.last-submitted
```

### Archiving Completed Reviews

After user authorizes next phase:
```bash
mv .kiro/reviews/requests/YYYYMMDD-HHMMSS-phase.md \
   .kiro/reviews/completed/
```

---

## Troubleshooting

### Hook doesn't trigger

**Symptoms:** Review request created but no notification sent

**Causes:**
- PostTaskExec may not fire for every Kiro response
- Task boundaries unclear in session
- Hook disabled or timeout exceeded

**Solutions:**
- Manually run: `bash .kiro/hooks/scripts/notify-firstmate.sh`
- Check hook configuration in `.kiro/hooks/notify-firstmate-review.json`
- Verify script is executable: `ls -l .kiro/hooks/scripts/notify-firstmate.sh`

### Delivery fails

**Symptoms:** Script reports "Failed to submit review request"

**Causes:**
- `fm-inbox.sh` command not found
- Firstmate not running or ready
- Path mismatch or permission issue

**Solutions:**
- Check supervisor readiness: `"$FM_HOME/bin/fm-inbox.sh" ready`
- Verify FM_HOME path matches actual Firstmate installation
- Check script has correct path to `fm-inbox.sh`

### Duplicate notifications

**Symptoms:** Same request sent multiple times

**Causes:**
- `.last-submitted` marker not created or deleted
- Script logic error

**Solutions:**
- Check marker file exists: `cat .kiro/reviews/.last-submitted`
- Review script logic in `notify-firstmate.sh`
- Manually create marker if needed

### Firstmate doesn't acknowledge

**Symptoms:** Notification delivered but no Firstmate response

**Causes:**
- Firstmate hasn't processed inbox yet
- Smoke test format incorrect
- Firstmate configuration issue

**Solutions:**
- Check Firstmate inbox: `ls -la /Users/paulobayuwana/Documents/projects/firstmate/state/inbox/`
- Verify notification file contents
- Check Firstmate logs for processing errors

---

## References

- **Supervisor Brief:** `/Users/paulobayuwana/Downloads/RecallFeed_Astra_Supervisor_Master_Brief.md`
- **Kiro Documentation:** https://kiro.dev/docs/
- **Kiro Custom Agents:** https://kiro.dev/docs/custom-agents/configuration-reference/
- **Kiro Hooks:** https://kiro.dev/docs/hooks/types/
- **Firstmate Inbox:** `/Users/paulobayuwana/Documents/projects/firstmate/bin/fm-inbox.sh`

---

**Setup Status:** ✓ Complete and Tested  
**Last Updated:** 2026-11-07 18:36:08 UTC  
**Smoke Test:** ✓ Passed
