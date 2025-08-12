#!/bin/bash
set -e

NETWORK=opencrvs_overlay_net
SERVICE_USER_MGNT="opencrvs_user-mgnt"
SERVICE_HEARTH_DEV="opencrvs_hearth"

# Get the MONGO_URL for user management service
MONGO_URL_USER_MGNT=$(docker service inspect "$SERVICE_USER_MGNT" \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
  | grep '^MONGO_URL=' \
  | cut -d'=' -f2-)

# Check if it was found
if [ -z "$MONGO_URL_USER_MGNT" ]; then
  echo "❌ MONGO_URL not set on service $SERVICE_USER_MGNT"
  exit 1
fi

# Get the MONGO_URL for hearth
MONGO_URL_HEARTH_DEV=$(docker service inspect "$SERVICE_HEARTH_DEV" \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
  | grep '^mongodb__url=' \
  | cut -d'=' -f2-)

# Check if it was found
if [ -z "$MONGO_URL_HEARTH_DEV" ]; then
  echo "❌ MONGO_URL_HEARTH_DEV not set on service $SERVICE_HEARTH_DEV"
  exit 1
fi

# InfluxDB details
INFLUX_HOST="influxdb"
INFLUX_PORT="8086"
INFLUX_DB="ocrvs"
EVENT_TYPE="LOGGED_IN"

QUERY="SELECT * FROM user_audit_event WHERE action = '$EVENT_TYPE'"

OUTPUT=$(docker run --rm --network "$NETWORK" influxdb:1.8 \
    influx -host "$INFLUX_HOST" -port "$INFLUX_PORT" -database "$INFLUX_DB" \
    -execute "$QUERY" \
    -format json)


# Process and print practitioner login counts
PRACTITIONER_STATS=$(echo "$OUTPUT" | jq '
  .results[0].series[0].values
  | map(.[4])                     # extract practitionerId
  | group_by(.)                   # group by practitionerId
  | map({practitionerId: .[0], loginCount: length})
')


# Extract practitionerIds to use in Mongo query
PRACTITIONER_IDS=$(echo "$PRACTITIONER_STATS" | jq -r '.[].practitionerId' | jq -R . | jq -s .)

# Query users collection to get practitioner info
USER_INFO=$(docker run --rm --network "$NETWORK" mongo \
  mongosh "$MONGO_URL_USER_MGNT" \
  --quiet --eval "
    JSON.stringify(
      db.users.find(
        { practitionerId: { \$in: $PRACTITIONER_IDS } },
        { _id: 0, practitionerId: 1, username: 1, primaryOfficeId: 1 }
      ).toArray()
    )
  ")


# Merge login attempts with practitioner info
ENRICHED_USER_INFO=$(jq '
  def login_map:
    map({ (.practitionerId): .loginCount }) | add;

  # Read input and enrich
  . as $input
  | $input.users as $users
  | $input.logins | login_map as $loginMap
  | $users | map(. + { loginCount: ($loginMap[.practitionerId] // 0) })
' <<< "{\"users\": $USER_INFO, \"logins\": $PRACTITIONER_STATS }")


# Group by primaryOfficeId and extract relevant fields
GROUPED_USER_INFO=$(echo "$ENRICHED_USER_INFO" | jq 'group_by(.primaryOfficeId) | map({ (.[0].primaryOfficeId): map({ username, practitionerId, loginCount }) }) | add')

# Extract unique primaryOfficeIds
PRIMARY_OFFICE_IDS=$(echo "$USER_INFO" | jq -r '.[].primaryOfficeId' | sort -u | jq -R . | jq -s .)


# Get location names from hearth
OFFICE_INFO=$(docker run --rm --network "$NETWORK" mongo \
  mongosh "$MONGO_URL_HEARTH_DEV" \
  --quiet --eval "
    JSON.stringify(
      db.Location.find(
        { id: { \$in: $PRIMARY_OFFICE_IDS } },
        { _id: 0, id: 1, name: 1 }
      ).toArray()
    )
  ")

ENRICHED_BY_OFFICE_NAME=$(jq --argjson offices "$OFFICE_INFO" --argjson users "$GROUPED_USER_INFO" '
  $offices
  | map({ key: .id, name: .name })                              # map to key-name pairs
  | map({ (.name): ($users[.key] // []) })                      # replace id with name if exists
  | add                                                         # merge into one object
' <<< '{}')


echo ""
echo "LOGIN STATS BY LOCATION"
echo "$ENRICHED_BY_OFFICE_NAME"