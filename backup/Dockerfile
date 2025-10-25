# Use PostgreSQL client image as base
FROM postgres:16

# Install cron for scheduled tasks
RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

# Create backup directory
RUN mkdir -p /backups

# Copy backup script
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Create cron job to run backup daily at 2 AM
RUN echo "0 2 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" | crontab -
RUN echo "@reboot /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" | crontab -

# Create log file
RUN touch /var/log/backup.log

# Expose backup directory as volume
VOLUME ["/backups"]

# Start cron in foreground
CMD ["cron", "-f"]
