const { Schema: _Schema, model } = require("mongoose");

    const Schema = _Schema;

    const pdfDocumentSchema =  new Schema({
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
            enum:  [
                'anhlikoi',
                'allodapoi',
                'oysiodeis_oroi',
                'arxeio_symbashs'
            ],
            required:  true,
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
        
        relativePath:  {
            type: String,
            required: true,
            comment: 'Relative path from uploads/ directory (e.g., pdfs/2026/01/12/filename.pdf)'
        },
        
        fileSize: {
            type: Number,
            required: true,
            min:  0
        },
        
        mimeType: {
            type:  String,
            default: 'application/pdf'
        },
        
        // Timestamps
        uploadDate: {
            type:  Date,
            default: Date. now,
            index: true
        },
        
        uploadedBy: {
            type:  Schema.Types.ObjectId,
            ref: 'User',
            required: false
        },
        
        // Metadata
        metadata: {
            checksum:  String,
            pageCount: Number,
            isArchived: {
                type: Boolean,
                default: false
            }
        }
    }, {
        timestamps:  true,
        collection: 'pdf_documents'
    });

    // ============================================================================
    // INDEXES για Performance
    // ============================================================================

    pdfDocumentSchema.index({ ergazomenosId: 1, documentType: 1 });
    pdfDocumentSchema.index({ uploadDate: -1 });

    // ============================================================================
    // VIRTUAL FIELDS
    // ============================================================================

    // Virtual για full file path
    pdfDocumentSchema. virtual('fullPath').get(function() {
        return `/uploads/${this.relativePath}`;
    });

    // ============================================================================
    // INSTANCE METHODS
    // ============================================================================

    // Method για διαγραφή αρχείου (file + database record)
    pdfDocumentSchema.methods.deleteFile = async function() {
        const fs = require('fs').promises;
        const path = require('path');
        
        const filePath = path.join(__dirname, '../uploads', this.relativePath);
        
        try {
            await fs.unlink(filePath);
            await this.deleteOne();
            return { success: true, message: 'File deleted successfully' };
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    };

    // ============================================================================
    // STATIC METHODS
    // ============================================================================

    // Εύρεση PDFs ενός εργαζόμενου
    pdfDocumentSchema.statics. findByErgazomenos = function(ergazomenosId, documentType = null) {
        const query = { ergazomenosId };
        if (documentType) {
            query.documentType = documentType;
        }
        return this.find(query).sort({ uploadDate: -1 });
    };

    // Cleanup παλιών αρχείων (για maintenance)
    pdfDocumentSchema.statics.cleanupOldFiles = async function(daysOld = 365) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        const oldDocs = await this.find({
            uploadDate: { $lt:  cutoffDate },
            'metadata.isArchived': true
        });
        
        for (const doc of oldDocs) {
            await doc.deleteFile();
        }
        
        return { deleted: oldDocs.length };
    };

    // Στατιστικά
    pdfDocumentSchema.statics.getStatistics = async function() {
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
                    totalSize: { $sum:  '$fileSize' }
                }
            }
        ]);
        
        return {
            byType: stats,
            total:  total[0] || { totalDocuments: 0, totalSize:  0 }
        };
    };

    // ============================================================================
    // MIDDLEWARE
    // ============================================================================

    // Pre-save:  Validate file path
    pdfDocumentSchema.pre('save', function(next) {
        if (this.relativePath && ! this.relativePath.startsWith('pdfs/')) {
            return next(new Error('Invalid relative path format'));
        }
        next();
    });

    // Pre-remove: Log deletion (optional)
    pdfDocumentSchema.pre('deleteOne', { document: true, query: false }, function(next) {
        console.log(`Deleting PDF document:  ${this.originalName} (${this.storedFilename})`);
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