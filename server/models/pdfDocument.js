// server/models/pdfDocument.js
// ✅ CORRECTED WITH S3 SUPPORT

const { Schema: _Schema, model, mongoose } = require('mongoose');
const Schema = _Schema;

const pdfDocumentSchema = new Schema(
    {
        // Σύνδεση με Εργαζόμενο
        ergazomenosId: {
            type: Schema.Types.ObjectId,
            ref: 'Ergazomenoi',
            required: true,
            index: true
        },

        // Τύπος εγγράφου
        documentType: {
            type: String,
            enum: ['anhlikoi', 'allodapoi', 'oysiodeis_oroi', 'arxeio_symbashs'],
            required: true,
            default: 'oysiodeis_oroi',
            index: true
        },

        // Πληροφορίες αρχείου
        originalName: {
            type: String,
            required: true,
            maxlength: 255,
            trim: true
        },

        storedFilename: {
            type: String,
            required: true,
            unique: true
        },

        // ✅ UPDATED: Now stores S3 key for new files, local path for legacy files
        relativePath: {
            type: String,
            required: true,
            comment:
                'S3 key (e.g., pdfs/123/anhlikoi/file.pdf) OR legacy local path (e.g., pdfs/2026/01/file.pdf)'
        },

        // ✅ NEW: S3-specific fields
        s3Key: {
            type: String,
            default: null,
            index: true,
            comment: 'S3 object key (same as relativePath for new uploads)'
        },

        s3Url: {
            type: String,
            default: null,
            comment: 'Direct S3 URL (https://bucket.s3.region.amazonaws.com/key)'
        },

        fileSize: {
            type: Number,
            required: true,
            min: 0
        },

        mimeType: {
            type: String,
            default: 'application/pdf'
        },

        // Timestamps
        uploadDate: {
            type: Date,
            default: Date.now,
            index: true
        },

        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false
        },

        // Metadata
        metadata: {
            checksum: String,
            pageCount: Number,
            isArchived: {
                type: Boolean,
                default: false
            }
        }
    },
    {
        timestamps: true,
        collection: 'pdf_documents'
    }
);

// ============================================================================
// INDEXES για Performance
// ============================================================================

pdfDocumentSchema.index({ ergazomenosId: 1, documentType: 1 });
pdfDocumentSchema.index({ uploadDate: -1 });

// ============================================================================
// VIRTUAL FIELDS
// ============================================================================

// ✅ UPDATED: Virtual για full path (S3 or local)
pdfDocumentSchema.virtual('fullPath').get(function () {
    if (this.s3Url) {
        return this.s3Url; // S3 URL
    }
    return `/uploads/${this.relativePath}`; // Legacy local path
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================

// ✅ UPDATED: Method για διαγραφή αρχείου (S3 or local)
pdfDocumentSchema.methods.deleteFile = async function () {
    const fs = require('fs').promises;
    const path = require('path');

    // ✅ If S3 file, use S3 helper (handled by controller)
    if (this.s3Key) {
        // Controller handles S3 deletion
        await this.deleteOne();
        return { success: true, message: 'File marked for deletion (S3 handled by controller)' };
    }

    // ✅ Legacy: Delete from local filesystem
    const filePath = path.join(__dirname, '../../uploads', this.relativePath);

    try {
        await fs.unlink(filePath);
        await this.deleteOne();
        return { success: true, message: 'Local file deleted successfully' };
    } catch (error) {
        console.error('Error deleting local file:', error);
        throw error;
    }
};

// ============================================================================
// STATIC METHODS
// ============================================================================

// Εύρεση PDFs ενός εργαζόμενου
pdfDocumentSchema.statics.findByErgazomenos = function (ergazomenosId, documentType = null) {
    const query = { ergazomenosId };
    if (documentType) {
        query.documentType = documentType;
    }
    return this.find(query).sort({ uploadDate: -1 });
};

// Cleanup παλιών αρχείων (για maintenance)
pdfDocumentSchema.statics.cleanupOldFiles = async function (daysOld = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const oldDocs = await this.find({
        uploadDate: mongoose.trusted({ $lt: cutoffDate }),
        'metadata.isArchived': true
    });

    for (const doc of oldDocs) {
        await doc.deleteFile();
    }

    return { deleted: oldDocs.length };
};

// Στατιστικά
pdfDocumentSchema.statics.getStatistics = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$documentType',
                count: { $sum: 1 },
                totalSize: { $sum: '$fileSize' }
            }
        }
    ]);

    const total = await this.aggregate([
        {
            $group: {
                _id: null,
                totalDocuments: { $sum: 1 },
                totalSize: { $sum: '$fileSize' }
            }
        }
    ]);

    return {
        byType: stats,
        total: total[0] || { totalDocuments: 0, totalSize: 0 }
    };
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// ✅ REMOVED: Overly strict validation (allows both S3 keys and legacy paths)

// Pre-remove: Log deletion
pdfDocumentSchema.pre('deleteOne', { document: true, query: false }, function (next) {
    console.log(
        `🗑️ Deleting PDF document: ${this.originalName} (${this.s3Key || this.storedFilename})`
    );
    next();
});

// ============================================================================
// EXPORT
// ============================================================================

module.exports = (() => {
    try {
        // Try to get existing model
        return model('pdfDocument');
    } catch (error) {
        // Model doesn't exist, create it
        return model('pdfDocument', pdfDocumentSchema);
    }
})();
