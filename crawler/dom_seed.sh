#!/bin/bash

FOXHOUND_PATH=../foxhound/foxhound node --max-old-space-size=8192 main.js --module=snapshoter --task=seed --browser=foxhound --storage=./storage --sitelist=sample.csv
