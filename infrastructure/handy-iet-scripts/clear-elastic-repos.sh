#!/bin/bash
set -e

: "${ELASTICSEARCH_ADMIN_PASSWORD:?Environment variable ELASTICSEARCH_ADMIN_PASSWORD is required}"

NETWORK=opencrvs_overlay_net

elasticsearch_host() {
  if [ ! -z ${ELASTICSEARCH_ADMIN_PASSWORD+x} ]; then
    echo "elastic:$ELASTICSEARCH_ADMIN_PASSWORD@elasticsearch:9200"
  else
    echo "elasticsearch:9200"
  fi
}

echo ""
echo "Delete snapshot repository"
echo ""
docker run --rm --network=$NETWORK appropriate/curl curl -a -X DELETE -H "Content-Type: application/json;charset=UTF-8" "http://$(elasticsearch_host)/_snapshot/ocrvs?pretty"
#-------------------------------------------------------------------------------------

echo ""
echo "Delete all backup snapshots"
echo ""

rm -rf /data/backups/elasticsearch/.* 2>/dev/null

#-------------------------------------------------------------------------------------
echo ""
echo "Register backup folder as an Elasticsearch repository for backing up the search data"
echo ""

create_elasticsearch_snapshot_repository() {
  OUTPUT=$(docker run --rm --network=$NETWORK appropriate/curl curl -s -X PUT -H "Content-Type: application/json;charset=UTF-8" "http://$(elasticsearch_host)/_snapshot/ocrvs" -d '{ "type": "fs", "settings": { "location": "/data/backups/elasticsearch", "compress": true }}' 2>/dev/null)
  while [ "$OUTPUT" != '{"acknowledged":true}' ]; do
    echo "Failed to register backup folder as an Elasticsearch repository. Trying again in..."
    sleep 1
    create_elasticsearch_snapshot_repository
  done
}

create_elasticsearch_snapshot_repository

#---------------------------------------------------------------------------------

echo ""
echo "Backup Elasticsearch as a set of snapshot files into an elasticsearch sub folder"
echo ""

create_elasticsearch_backup() {
  OUTPUT=""
  OUTPUT=$(docker run --rm --network=$NETWORK appropriate/curl curl -s -X PUT -H "Content-Type: application/json;charset=UTF-8" "http://$(elasticsearch_host)/_snapshot/ocrvs/snapshot_${LABEL:-$BACKUP_DATE}?wait_for_completion=true&pretty" -d '{ "indices": "ocrvs" }' 2>/dev/null)
  if echo $OUTPUT | jq -e '.snapshot.state == "SUCCESS"' > /dev/null; then
    echo "Snapshot state is SUCCESS"
  else
    echo $OUTPUT
    echo "Failed to backup Elasticsearch. Trying again in..."
    create_elasticsearch_backup
  fi
}

create_elasticsearch_backup