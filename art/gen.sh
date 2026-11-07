#!/bin/zsh
# 1枚生成。gen.sh <名前>。生成元はリポジトリ外の _art_raw/jibun-migaki
k=$1; P="$(cd "$(dirname "$0")" && pwd)"; cd "$P/../../_art_raw/jibun-migaki"; mkdir -p raw logs; [[ -s raw/$k.png ]] && { echo "$k skip"; exit 0; }
s=1024x1536; case $k in items|shelf|rack) s=1536x1024;; console) s=1024x1024;; esac
ref=""
case $k in futsuu|me0|room|items|shelf|rack|console) ;; me1|me2) ref=raw/me0.png;; *) ref=raw/futsuu.png;; esac
python3 ~/.claude/skills/3d-homepage/scripts/codex_imagegen.py raw/$k.png "$P/prompts/$k.md" ${ref:+$ref} --quality high --size $s > logs/$k.log 2>&1; echo "$k done $?"
