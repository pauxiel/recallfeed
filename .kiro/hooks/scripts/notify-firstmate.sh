#!/bin/bash
set -e

# Find the most recent review request that hasn't been submitted
REVIEW_DIR=".kiro/reviews/requests"
SUBMITTED_MARKER=".kiro/reviews/.last-submitted"

# Exit silently if no review requests directory
if [ ! -d "$REVIEW_DIR" ]; then
  exit 0
fi

# Find newest review request file
NEWEST_REQUEST=$(find "$REVIEW_DIR" -name '*.md' -type f -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -n 1)

# Exit silently if no review requests
if [ -z "$NEWEST_REQUEST" ]; then
  exit 0
fi

# Check if this request was already submitted
if [ -f "$SUBMITTED_MARKER" ]; then
  LAST_SUBMITTED=$(cat "$SUBMITTED_MARKER")
  if [ "$NEWEST_REQUEST" = "$LAST_SUBMITTED" ]; then
    # Already submitted, exit silently
    exit 0
  fi
fi

# Extract review request ID from filename (format: YYYYMMDD-HHMMSS-phase.md)
REQUEST_FILENAME=$(basename "$NEWEST_REQUEST")
REQUEST_ID="recallfeed-${REQUEST_FILENAME%.md}"

# Prepare notification body
NOTIFICATION=$(cat <<EOF
{
  "source": "kiro-cli",
  "project": "RecallFeed",
  "request_type": "review",
  "request_id": "$REQUEST_ID",
  "handoff_path": "$NEWEST_REQUEST",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "message": "Kiro CLI has completed a RecallFeed milestone and requests read-only evaluation. Please review the immutable handoff document at: $NEWEST_REQUEST"
}
EOF
)

# Send notification to Firstmate
if echo "$NOTIFICATION" | FM_HOME=/Users/paulobayuwana/Documents/projects/firstmate /Users/paulobayuwana/Documents/projects/firstmate/bin/fm-inbox.sh note --json --request-id "$REQUEST_ID" - ; then
  # Mark this request as submitted
  echo "$NEWEST_REQUEST" > "$SUBMITTED_MARKER"
  echo "✓ Review request submitted to Firstmate: $REQUEST_ID" >&2
  exit 0
else
  echo "✗ Failed to submit review request to Firstmate" >&2
  exit 1
fi
