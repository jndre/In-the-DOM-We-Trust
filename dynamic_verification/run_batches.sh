#!/bin/bash

# Configurations
TOTAL_START=1
TOTAL_END=2800
BATCH_SIZE=400
SLEEP_TIME=420  # 7 minutes in seconds
INPUT_DIR="./flows"

# Loop through the index range in chunks of BATCH_SIZE
for ((batch_start=$TOTAL_START; batch_start<$TOTAL_END; batch_start+=$BATCH_SIZE)); do
    batch_end=$((batch_start + BATCH_SIZE))
    
    echo ">>> Launching batch from $batch_start to $batch_end"
    ./run_all.sh $INPUT_DIR $batch_start $batch_end 1

    echo ">>> Waiting for $SLEEP_TIME seconds (7 minutes) before stopping this batch..."
    sleep $SLEEP_TIME

    echo ">>> Stopping all running screen sessions..."
    ./stop_all.sh
    echo ">>> Batch from $batch_start to $batch_end completed."
    echo "---------------------------------------------"

    sleep 5

done

echo " ^|^e All batches completed!"
