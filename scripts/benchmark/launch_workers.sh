#!/usr/bin/env bash
set -euo pipefail

COUNT="${1:-3}"
LAUNCH_TEMPLATE_NAME="${LAUNCH_TEMPLATE_NAME:-cab-worker-template}"
AWS_REGION="${AWS_REGION:-us-east-2}"

# Launch N worker instances from the launch template
INSTANCE_IDS=$(
  aws ec2 run-instances \
    --region "$AWS_REGION" \
    --launch-template "LaunchTemplateName=${LAUNCH_TEMPLATE_NAME}" \
    --count "$COUNT" \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Project,Value=CAB},{Key=Role,Value=worker},{Key=ManagedBy,Value=benchmark-script}]' \
    --query 'Instances[].InstanceId' \
    --output text
)

echo "Launched worker instance IDs:"
echo "$INSTANCE_IDS"

# Wait until all are running
aws ec2 wait instance-running \
  --region "$AWS_REGION" \
  --instance-ids $INSTANCE_IDS

echo "Workers are running."

# Apply stable sequential names/indices
i=0
for ID in $INSTANCE_IDS; do
  aws ec2 create-tags \
    --region "$AWS_REGION" \
    --resources "$ID" \
    --tags \
      "Key=Name,Value=cab-worker-$(printf '%02d' "$i")" \
      "Key=WorkerIndex,Value=$i"
  i=$((i+1))
done

echo "Tagged workers."