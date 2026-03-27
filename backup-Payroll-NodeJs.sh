#!/bin/bash

# ============================================================
# Backup script για Payroll-NodeJs
# Δημιουργεί: Payroll-NodeJs-backup-YYYYMMDD-HHMM.tar.gz
# ============================================================

# Φάκελος πηγής (ο φάκελος του project)
SOURCE_DIR="$HOME/Projects/Payroll-NodeJs"

# Φάκελος αποθήκευσης backup
BACKUP_DIR="$HOME/Backups"

# Timestamp: YYYYMMDD-HHMM
TIMESTAMP=$(date +"%Y%m%d-%H%M")

# Όνομα αρχείου backup
BACKUP_FILE="Payroll-NodeJs-backup-${TIMESTAMP}.tar.gz"

# Δημιουργία φακέλου backup αν δεν υπάρχει
mkdir -p "$BACKUP_DIR"

echo "🔄 Δημιουργία backup: ${BACKUP_FILE} ..."

# Δημιουργία tar.gz εξαιρώντας φακέλους που δεν χρειάζονται
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
    --exclude="$SOURCE_DIR/node_modules" \
    --exclude="$SOURCE_DIR/.git" \
    --exclude="$SOURCE_DIR/uploads/s3-mock/xlsx" \
    --exclude="$SOURCE_DIR/uploads/s3-mock/pdfs" \
    --exclude="$SOURCE_DIR/uploads/s3-mock/contracts" \
    --exclude="$SOURCE_DIR/uploads/s3-mock/txt" \
    --exclude="$SOURCE_DIR/uploads/s3-mock/xmls" \
    --exclude="$SOURCE_DIR/public/pdf" \
    --exclude="$SOURCE_DIR/tmp" \
    "$SOURCE_DIR"

# Έλεγχος αν το backup δημιουργήθηκε επιτυχώς
if [ $? -eq 0 ]; then
    SIZE=$(du -sh "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo "✅ Backup ολοκληρώθηκε: $BACKUP_DIR/$BACKUP_FILE ($SIZE)"
else
    echo "❌ Σφάλμα κατά τη δημιουργία backup!"
    exit 1
fi