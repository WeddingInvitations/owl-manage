#!/usr/bin/env bash
set -euo pipefail

# Use the Cloud Build service account (ADC), never a stored Firebase token.
target="${1:?Missing Firebase deployment target}"
log_file="$(mktemp)"
trap 'rm -f "$log_file"' EXIT

npx --yes firebase-tools@14.22.0 deploy \
  --project owl-manage \
  --only "$target" \
  --non-interactive 2>&1 | tee "$log_file"

# The observed CLI run exited 0 after function failures, before releasing Hosting.
# Require the normal final success marker in addition to the process exit code.
if ! grep -Fq 'Deploy complete!' "$log_file"; then
  echo "ERROR: Firebase exited without confirming deployment completion ($target)." >&2
  exit 1
fi

if grep -Eq 'failed to (create|update|delete|deploy) function' "$log_file"; then
  echo "ERROR: Firebase reported a failed function operation ($target)." >&2
  exit 1
fi