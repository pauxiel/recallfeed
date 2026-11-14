#!/usr/bin/env bash
# Optional: announce the newest committed review request to a local supervisor inbox.
#
# Nothing here is required to build or test RecallFeed. With no configuration this script
# prints one line and exits 0.
#
# Configure locally (never commit personal paths or credentials):
#   * export FM_HOME=<supervisor home directory>, or
#   * put the line FM_HOME=<supervisor home directory> in
#     ${XDG_CONFIG_HOME:-$HOME/.config}/recallfeed/firstmate.env
# The inbox command is "$FM_HOME/bin/fm-inbox.sh".
#
# Usage: notify-firstmate.sh [--dry-run]
#   --dry-run  print the notification JSON and exit; send nothing, write no marker.
#
# The script runs in the checkout it is started from, which may be an isolated
# git worktree. The notification reports that actual workspace, branch, and commit,
# so the reviewer does not have to assume the primary checkout.
set -euo pipefail

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

REVIEW_DIR=".kiro/reviews/requests"
SUBMITTED_MARKER=".kiro/reviews/.last-submitted"

WORKSPACE="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "notify-firstmate: not inside a git checkout; nothing sent." >&2
  exit 0
}
cd "$WORKSPACE"

# Local, optional configuration.
if [ -z "${FM_HOME:-}" ]; then
  CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/recallfeed/firstmate.env"
  if [ -f "$CONFIG_FILE" ]; then
    FM_HOME="$(sed -n 's/^FM_HOME=//p' "$CONFIG_FILE" | tail -n 1)"
  fi
fi
if [ -z "${FM_HOME:-}" ] && [ "$DRY_RUN" -eq 0 ]; then
  echo "notify-firstmate: supervisor integration is not configured (set FM_HOME); nothing sent." >&2
  exit 0
fi

[ -d "$REVIEW_DIR" ] || exit 0

# Newest request by file name. Names start with YYYYMMDD-HHMMSS, so name order is time order.
# File modification times are not used: a fresh checkout gives every file the same time.
NEWEST_REQUEST="$(find "$REVIEW_DIR" -maxdepth 1 -name '*.md' -type f | LC_ALL=C sort | tail -n 1)"
[ -n "$NEWEST_REQUEST" ] || exit 0

if [ "$DRY_RUN" -eq 0 ] && [ -f "$SUBMITTED_MARKER" ] && [ "$(cat "$SUBMITTED_MARKER")" = "$NEWEST_REQUEST" ]; then
  exit 0 # already submitted
fi

# A review request is only immutable once it is committed. Refuse to announce one that is not.
if ! git ls-files --error-unmatch -- "$NEWEST_REQUEST" >/dev/null 2>&1 \
  || [ -n "$(git status --porcelain -- "$NEWEST_REQUEST")" ]; then
  echo "notify-firstmate: $NEWEST_REQUEST is not committed (or has uncommitted edits); commit it first. Nothing sent." >&2
  exit 1
fi

BRANCH="$(git branch --show-current)"
COMMIT="$(git rev-parse HEAD)"
REQUEST_COMMIT="$(git log -n 1 --format=%H -- "$NEWEST_REQUEST")"
REQUEST_SHA256="$(shasum -a 256 "$NEWEST_REQUEST" | cut -d ' ' -f 1)"
GIT_DIR_ABS="$(git rev-parse --absolute-git-dir)"
COMMON_DIR_ABS="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
if [ "$GIT_DIR_ABS" != "$COMMON_DIR_ABS" ]; then
  ISOLATED=true
  PRIMARY_CHECKOUT="$(dirname "$COMMON_DIR_ABS")"
else
  ISOLATED=false
  PRIMARY_CHECKOUT="$WORKSPACE"
fi
REQUEST_FILENAME="$(basename "$NEWEST_REQUEST")"
REQUEST_ID="recallfeed-${REQUEST_FILENAME%.md}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Build the JSON with Node (already required by this project) so paths and branch names are
# escaped correctly.
NOTIFICATION="$(
  REQUEST_ID="$REQUEST_ID" NEWEST_REQUEST="$NEWEST_REQUEST" WORKSPACE="$WORKSPACE" \
  PRIMARY_CHECKOUT="$PRIMARY_CHECKOUT" ISOLATED="$ISOLATED" BRANCH="$BRANCH" COMMIT="$COMMIT" \
  REQUEST_COMMIT="$REQUEST_COMMIT" REQUEST_SHA256="$REQUEST_SHA256" TIMESTAMP="$TIMESTAMP" \
  node -e '
    const e = process.env;
    const payload = {
      source: "kiro-cli",
      project: "RecallFeed",
      request_type: "review",
      request_id: e.REQUEST_ID,
      handoff_path: e.NEWEST_REQUEST,
      workspace_path: e.WORKSPACE,
      isolated_workspace: e.ISOLATED === "true",
      primary_checkout_path: e.PRIMARY_CHECKOUT,
      branch: e.BRANCH,
      commit: e.COMMIT,
      request_commit: e.REQUEST_COMMIT,
      request_sha256: e.REQUEST_SHA256,
      timestamp: e.TIMESTAMP,
      message:
        "Kiro CLI requests read-only review. Read the committed request at " +
        e.NEWEST_REQUEST + " in the workspace " + e.WORKSPACE + " (branch " + e.BRANCH +
        ", commit " + e.COMMIT + "). That workspace may not be the primary checkout.",
    };
    process.stdout.write(JSON.stringify(payload, null, 2));
  '
)"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "$NOTIFICATION"
  exit 0
fi

INBOX="$FM_HOME/bin/fm-inbox.sh"
if [ ! -x "$INBOX" ]; then
  echo "notify-firstmate: $INBOX is not an executable file; nothing sent." >&2
  exit 1
fi

if echo "$NOTIFICATION" | FM_HOME="$FM_HOME" "$INBOX" note --json --request-id "$REQUEST_ID" -; then
  echo "$NEWEST_REQUEST" > "$SUBMITTED_MARKER"
  echo "Review request submitted: $REQUEST_ID (workspace $WORKSPACE, branch $BRANCH, commit ${COMMIT:0:7})" >&2
  exit 0
else
  echo "notify-firstmate: delivery failed for $REQUEST_ID; it will be retried next time." >&2
  exit 1
fi
