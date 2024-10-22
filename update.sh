#!/bin/bash

UpdateSvg() {
    node find_svg.mjs
    changes=$(git ls-files -s $(git ls-files -m) | sed -e '/^16/d' )
    if [ -n "$changes" ]; then
        echo "Changes detected"
        git add -A
        git commit -S -a -m "$(git status --porcelain | wc -l) svgs | $(git status --porcelain|awk '{print "basename " $2}'| sh | sed '{:q;N;s/\n/, /g;t q}')"
        git push
    else    
        echo "No changes detected"
    fi
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