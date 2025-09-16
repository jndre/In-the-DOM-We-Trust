#!/usr/bin/env bash

# IMPORTANT: this way of installing and using neo4j has been deprecated. Install and use ineo instead (linux_ineo_installation.sh)

VERSION='3.5'

wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/neotechnology.gpg
echo 'deb [signed-by=/etc/apt/keyrings/neotechnology.gpg] https://debian.neo4j.com stable' $VERSION | sudo tee -a /etc/apt/sources.list.d/neo4j.list
sudo apt-get update
sudo apt-get install neo4j
