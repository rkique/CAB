#!/usr/bin/env bash
export KEY="/Users/IsaacBrownAccount/Downloads/cab-dev-key.pem"
export APP_DIR="~/CAB"
export COORD="ubuntu@3.22.61.95"
WORKER_NAMES=("worker0" "worker1" "worker2")
WORKER_HOSTS=("ubuntu@3.135.217.171" "ubuntu@3.17.174.67" "ubuntu@18.217.187.59")
ALL_HOSTS=("$COORD" "${WORKER_HOSTS[@]}")
