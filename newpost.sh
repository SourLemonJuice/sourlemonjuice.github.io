#!/usr/bin/env bash

set -euo pipefail

function print_help {
    cat <<EOF
Usage: newpost.sh [--help] <post_id>
EOF
}

if [[ "$#" -ne 1 ]]; then
    echo -e "Arguments not enough\n"
    print_help
    exit 1
fi

if [[ "$1" == "--help" ]]; then
    print_help
    exit
fi

if [[ ! -f "./_config.yml" ]]; then
    echo "This script needs to be run from the repository root"
    exit 1
fi

post_id="$1"

base_path="posts2/$(date +%Y)/_posts"
mkdir -p "${base_path}"

post_path="${base_path}/$(date +%Y-%m-%d)-${post_id}.md"
read -p "Press enter to create: ${post_path}"

if [[ -f "${post_path}" ]]; then
    read -p "File already exists, override?(input ignore, ctrl-c to cancel)"
fi

cat <<EOF > "${post_path}"
---
lang: "zh-Hans"
title: "${post_id}"
date: $(date "+%Y-%m-%d %R %z")
---
EOF
