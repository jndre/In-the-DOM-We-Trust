#!/bin/bash
patch -p4 -N --directory="$(pwd)/.." < pw-encoding.diff
