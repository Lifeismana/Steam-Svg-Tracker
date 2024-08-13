#!/bin/bash

UpdateSvg() {
    node find_svg.mjs
    git add -A
    git commit -S -a -m "$(git status --porcelain | wc -l) svgs | $(git status --porcelain|awk '{print "basename " $2}'| sh | sed '{:q;N;s/\n/, /g;t q}')"
    git push
}

set -e

cd "$(dirname "$0")"

if [[ $1 = "force" ]]; then
    echo "forcing update"
    UpdateSvg
fi

preupdate="$(git submodule status)"
git submodule update --remote
postupdate="$(git submodule status)"

if [ "$preupdate" != "$postupdate" ]; then
    echo "submodules updated"
    UpdateSvg
else
    echo "submodules not updated"
fi