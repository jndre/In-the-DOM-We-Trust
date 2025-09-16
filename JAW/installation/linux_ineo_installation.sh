#!/bin/bash

# installs ineo (https://github.com/cohesivestack/ineo) using the convenience script
curl -sSL https://raw.githubusercontent.com/cohesivestack/ineo/v2.1.0/ineo | bash -s install
source ~/.bashrc

# to uninstall run 'ineo uninstall -d "~/.ineo" && rm -rf ~/.ineo'
