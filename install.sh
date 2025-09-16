#!/bin/bash

cd crawler
npm install
cd patches
bash apply.sh
cd ../..

cd exploit_generator
npm install
cd ..

cd exploit_validator
npm install
cd patches
bash apply.sh
cd ../..

cd JAW
bash install.sh
bash installation/linux_ineo_installation.sh
cd ..

cd dynamic_verification
npm install
cd ..
