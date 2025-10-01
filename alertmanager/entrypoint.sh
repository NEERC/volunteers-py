#!/bin/sh
echo "Start entrypoint"
sed -e "s/\${VOLUNTEERS_TELEGRAM__ALERT_TOKEN}/$VOLUNTEERS_TELEGRAM__ALERT_TOKEN/" -e "s/\${VOLUNTEERS_TELEGRAM__CHAT_ID}/$VOLUNTEERS_TELEGRAM__CHAT_ID/" /etc/alertmanager/alertmanager.template.yml > /etc/alertmanager/alertmanager.yml

cat /etc/alertmanager/alertmanager.yml
# Run original Alertmanager command
exec /bin/alertmanager "$@"
