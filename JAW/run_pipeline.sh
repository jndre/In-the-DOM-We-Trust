#!/usr/bin/env bash

if [ ! -d "./data" ]; then
    ln -s ../crawler/storage/data ./data
fi

source .venv/bin/activate
python3 -m run_pipeline --conf=config.yaml
