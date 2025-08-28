#!/bin/bash

# Path to the Node.js script
SCRIPT_PATH="./dynamic_verification.js"
XDG_CONFIG_HOME=/tmp/chrome
XDG_CACHE_HOME=/tmp/chrome

# Arguments: start, end, and step
INPUT_DIR=$1
START_INDEX=$2
END_INDEX=$3
STEP=$4

if [ -z "$INPUT_DIR" ] || [ -z "$START_INDEX" ] || [ -z "$END_INDEX" ] || [ -z "$STEP" ]; then
    echo "Usage: $0 <input_dir> <start_index> <end_index> <step_size>"
    exit 1
fi

# Counter for screen session names and log files
counter=1

# Loop to create screen sessions
for ((i=$START_INDEX; i<$END_INDEX; i+=$STEP)); do
    # Calculate the upper bound for this chunk
    next_i=$((i + STEP))

    # Start a new screen session
    screen -dmS verifier_screen$counter bash -c "node --max-old-space-size=4096 $SCRIPT_PATH $INPUT_DIR $i $next_i > .LOGFILE$counter 2>&1"

    echo "Started screen verifier_screen$counter for range $i to $next_i"

    # Increment counter for the next screen session
    ((counter++))
done

echo "All screens started, and logs are being saved to .LOGFILE{1-$counter}"
