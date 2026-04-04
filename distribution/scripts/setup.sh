#!/usr/bin/env bash
set -e

# Check if we are inside a git repository, otherwise exit
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    echo "[setup] not insde a git repository, make sure your project is under git version control" >&2
    exit 1
fi

function staleness()
{
  course_repo="brown-cs1380/stencil"

  remote="upstream"

  if [ -z "$remote" ]; then
    echo "[setup] could not find a remote named 'upstream' pointing to the course repo."
    echo "[setup] If you forked the repo, please add the course repo as 'upstream' once:"
    echo "[setup]   git remote add upstream https://github.com/${course_repo}.git"
    echo "[setup]   git fetch upstream"
    return 0
  fi

  git fetch --quiet upstream
  branch=$(git symbolic-ref --short HEAD)

  base_ref="refs/remotes/${remote}/${branch}"

  if ! git show-ref --verify --quiet "$base_ref"; then
    if git show-ref --verify --quiet "refs/remotes/${remote}/main"; then
      base_ref="refs/remotes/${remote}/main"
    elif git show-ref --verify --quiet "refs/remotes/${remote}/master"; then
      base_ref="refs/remotes/${remote}/master"
    else
      echo "[setup] could not find a suitable base branch on '$remote' (no main/master). Skipping."
      return 0
    fi
  fi
  
  behind="$(git rev-list --count HEAD.."$base_ref" 2>/dev/null || echo 0)"

  if [ "$behind" -gt 0 ]; then
    echo "[setup] your branch '$branch' is behind '$base_ref' by $behind commits. Please pull the latest changes."
    echo "[setup]  git fetch upstream"
    echo "[setup]  git merge upstream/$(basename "$base_ref")"
    echo "[setup]  # or: git rebase upstream/$(basename "$base_ref")"
  else
    echo "[setup] your branch '$branch' is up to date with '$base_ref'!"
  fi
}

top=$(git rev-parse --show-toplevel)
cd "$top" || exit 1

if command -v ssh; then staleness; fi

npm install
npm update @brown-ds/distribution
( cd non-distribution && npm install )
