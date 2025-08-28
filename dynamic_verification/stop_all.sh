#!/bin/bash

# Find and stop all screen sessions starting with "verifier_screen"
for screen_name in $(screen -list | grep -o "verifier_screen[^	]*" | awk '{print $1}'); do
    echo "Stopping and deleting screen: $screen_name"
    screen -S "$screen_name" -X quit
done

echo "All screens starting with 'verifier_screen' have been stopped."

# Stop Chrome instances
pkill -f chrome -9
pkill -f chrome
kill -9 $(ps -x | grep chrome)