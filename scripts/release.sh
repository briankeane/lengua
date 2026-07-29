#!/bin/bash

set -e

echo "Create Release PR"
echo "=================="
echo ""

# Fetch latest refs
git fetch origin main develop --quiet

# Find the last release merge (develop merged into main) to use as the base.
# This handles squash merges correctly — origin/main..origin/develop misses
# squash-merged PRs because those commits are reachable from both branches
# after a release merge.
LAST_RELEASE=$(git log origin/main --merges --pretty=format:"%H %s" 2>/dev/null \
  | grep "from .*/develop$" \
  | head -1 \
  | awk '{print $1}')

if [ -z "$LAST_RELEASE" ]; then
  BASE="origin/main"
else
  BASE="$LAST_RELEASE"
fi

echo "PRs in this release:"
echo "--------------------"
{
  # Merge commits: "Merge pull request #123 ..."
  git log "$BASE"..origin/develop --merges --pretty=format:"%s" 2>/dev/null | grep "^Merge pull request" | grep -oE '#[0-9]+'
  # Squash-merged commits: "feat: some feature (#123)"
  git log "$BASE"..origin/develop --no-merges --pretty=format:"%s" 2>/dev/null | grep -oE '\(#[0-9]+\)' | grep -oE '#[0-9]+'
} | sort -t'#' -k1 -rn | uniq | while read pr; do
  num=${pr#\#}
  title=$(gh pr view "$num" --json title --jq '.title' 2>/dev/null)
  echo "  $pr: $title"
done
echo ""

read -p "Release title: " release_title

if [ -z "$release_title" ]; then
  echo "Release title is required. Exiting."
  exit 1
fi

echo ""
echo "Select version bump type:"
echo "  1) patch  - Bug fixes, small changes (0.0.X)"
echo "  2) minor  - New features, backwards compatible (0.X.0)"
echo "  3) major  - Breaking changes (X.0.0)"
echo ""

read -p "Enter choice [1-3]: " choice

case $choice in
  1)
    bump_type="patch"
    ;;
  2)
    bump_type="minor"
    ;;
  3)
    bump_type="major"
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

echo ""
echo "Creating $bump_type release PR: \"$release_title\"..."
echo ""

gh workflow run create-release-pr.yml -f version_bump="$bump_type" -f release_title="$release_title"

echo "Workflow triggered! View progress at:"
gh run list --workflow=create-release-pr.yml --limit=1
