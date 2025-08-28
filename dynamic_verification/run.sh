#!/bin/bash

node export_flows ./flows

node --max-old-space-size=4096 dynamic_verification.js ./flows 0 10