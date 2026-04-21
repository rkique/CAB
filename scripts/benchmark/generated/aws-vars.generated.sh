#!/usr/bin/env bash
export KEY="/Users/IsaacBrownAccount/Downloads/cab-dev-key.pem"
export APP_DIR="~/CAB"
export COORD="ubuntu@3.131.48.56"
WORKER_NAMES=("worker0" "worker1" "worker2")
WORKER_HOSTS=("ubuntu@18.191.22.173" "ubuntu@18.119.157.210" "ubuntu@18.118.33.246")
ALL_HOSTS=("$COORD" "${WORKER_HOSTS[@]}")
