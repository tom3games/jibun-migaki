#!/bin/zsh
cd "$(dirname "$0")"
print -l me_smart1 me_smart2 me_smart3 me_buff1 me_buff2 me_smartbuff me_smartstyle me_buffstyle me_allhigh me_tired me_injury me_gamer me_party | xargs -P 5 -I{} ./gen.sh {}
echo ALLDONE
