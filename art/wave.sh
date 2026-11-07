#!/bin/zsh
cd "$(dirname "$0")"
print -l futsuu me0 room items shelf rack | xargs -P 6 -I{} ./gen.sh {}
print -l takane imo pillow otaku protein narcis prof inteli gal rich goukon cat robot granny nurse gamer me1 me2 | xargs -P 5 -I{} ./gen.sh {}
echo ALLDONE
