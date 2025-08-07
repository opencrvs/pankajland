#!/bin/bash
set -e

NETWORK=opencrvs_default
SERVICE_NAME="opencrvs_user-mgnt"

# Get the MONGO_URL from the service's task template env vars
MONGO_URL=$(docker service inspect "$SERVICE_NAME" \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
  | grep '^MONGO_URL=' \
  | cut -d'=' -f2-)

# Check if it was found
if [ -z "$MONGO_URL" ]; then
  echo "❌ MONGO_URL not set on service $SERVICE_NAME"
  exit 1
fi

#-------------------------------------------------------------------------------------

echo ""
echo "Get an array of practitionerIds for all users in the system from Mongo"
echo ""

RESULT=$(docker run --rm --network=$NETWORK mongo \
  mongosh "$MONGO_URL" \
  --quiet --eval '
    JSON.stringify(
        db.users.aggregate([
        { $match: { practitionerId: { $exists: true } } },
        { $project: { _id: 0, practitionerId: 1 } },
        { $group: {
            _id: null,
            practitionerIds: { $addToSet: "$practitionerId" }
        }},
        { $project: { _id: 0, practitionerIds: 1 } }
        ]).toArray()
    )
  ')

echo "Result: $RESULT"


# InfluxDB details
INFLUX_HOST="influxdb"
INFLUX_PORT="8086"
INFLUX_DB="ocrvs"
EVENT_TYPE="LOGGED_IN"

# Loop through each practitionerId
for practitionerId in $(echo "$RESULT" | jq -r '.[0].practitionerIds[]'); do
  echo "🔍 Practitioner ID: $practitionerId"

  QUERY="SELECT * FROM user_audit_event WHERE practitionerId = '$practitionerId' AND action = '$EVENT_TYPE'"

  OUTPUT=$(docker run --rm --network "$NETWORK" influxdb:1.8 \
    influx -host "$INFLUX_HOST" -port "$INFLUX_PORT" -database "$INFLUX_DB" \
    -execute "$QUERY" \
    -format json)

  echo "PractitionerId: $practitionerId OUTPUT:"
  echo $OUTPUT
done