#!/bin/bash

if [[ $# -lt 3 ]] ; then
    echo 'Usage: startup.sh module task browser num'
    exit 1
fi

mkdir -p logs
rm -f logs/$2*

for i in `seq 0 $(($4 - 1))`; do
    echo "$2 $i"
    nice bash ./respawn.sh $1 $2 $3 $i $4 &
    sleep 1
done
