#!/bin/bash
ulimit -m 2000000
cmd="FOXHOUND_PATH=../foxhound/foxhound node --max-old-space-size=8192 main.js --module=$1 --task=$2 --browser=$3 --id=$4 --total=$5 --sitelist=$6 --storage=./storage >> logs/$2$4.txt 2>&1"


while true; do
    echo "$cmd"
    eval $cmd
    # Stop if exit code indicates no error
    if [ $? -eq 0 ]; then
        break;
    fi
    sleep 10
done
