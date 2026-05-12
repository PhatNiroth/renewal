#!/bin/bash
set -a
source /var/www/krawma/.env
set +a
curl -s "${NEXT_PUBLIC_APP_URL}/api/cron/notifications" \
  -H "Authorization: Bearer $CRON_SECRET"
