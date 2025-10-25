#!/bin/bash

# Database backup script
# This script creates daily PostgreSQL backups and manages old backups

set -e

# Configuration
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-2}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

echo "Starting database backup at $(date)"
echo "Backup file: $BACKUP_FILE"

# Set PGPASSWORD environment variable for pg_dump
export PGPASSWORD="$DB_PASSWORD"

# Create the backup
pg_dumpall -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
    --verbose \
    --no-password \
    > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: $BACKUP_FILE"

    # Get file size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup size: $BACKUP_SIZE"
else
    echo "Backup failed!"
    exit 1
fi

# Compress backups older than retention period
echo "Compressing backups older than $RETENTION_DAYS days..."

# Find SQL files older than retention period and compress them
find "$BACKUP_DIR" -name "backup_*.sql" -type f -mtime +$RETENTION_DAYS | while read -r file; do
    if [ -f "$file" ]; then
        echo "Compressing: $file"
        gzip "$file"
        echo "Compressed: $file.gz"
    fi
done

# Clean up old compressed backups (keep compressed backups for 30 days)
echo "Cleaning up compressed backups older than 30 days..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +30 -delete

echo "Backup process completed at $(date)"

# List current backups
echo "Current backups:"
ls -lah "$BACKUP_DIR"/backup_* 2>/dev/null || echo "No backups found"
