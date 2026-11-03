# Use PostgreSQL client image as base
FROM postgres:16

# Install cron for scheduled tasks
RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

# Create backup directory
RUN mkdir -p /backups

# Copy backup script
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Run backup daily at 2 AM and on container start (one crontab, `crontab -` replaces it)
RUN printf '%s\n' \
    "0 2 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" \
    "@reboot /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" \
    | crontab -

# Create log file
RUN touch /var/log/backup.log

# Expose backup directory as volume
VOLUME ["/backups"]

# Start cron in foreground
CMD ["cron", "-f"]
