#!/bin/sh
set -e

# Setup crontabs directory and data log destination
mkdir -p /var/spool/cron/crontabs /data/app

# Every 15 minutes, trigger the internal sync API and append output to sync.log
cat << 'EOF' > /var/spool/cron/crontabs/root
*/15 * * * * wget -qO- --post-data="" --header="x-internal-cron: true" http://127.0.0.1:3000/api/admin/sync >> /data/app/sync.log 2>&1
EOF

chmod 0600 /var/spool/cron/crontabs/root

# Start busybox crond in the background
crond -b -l 2 -L /data/app/crond.log

# Trigger initial sync in background once server starts up
(
  sleep 10
  wget -qO- --post-data="" --header="x-internal-cron: true" http://127.0.0.1:3000/api/admin/sync >> /data/app/sync.log 2>&1 || true
) &

# Hand over to server command
exec "$@"
