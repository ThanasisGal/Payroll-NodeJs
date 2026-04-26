const { Schema, model } = require('mongoose');

const usageLogSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        team: {
            type: String,
            required: true
        },
        loginAt: {
            type: Date,
            required: true
        },
        logoutAt: {
            type: Date,
            default: null
        },
        durationMs: {
            type: Number,
            default: 0
        },
        lastSeen: {
            type: Date,
            default: null
        },
        sessionExpires: {
            type: Date,
            default: null
        },
        closedBy: {
            type: String,
            enum: ['logout', 'browser_close', 'session_expired', null],
            default: null
        },
        date: {
            type: String, // 'YYYY-MM' για εύκολο μηνιαίο grouping
            required: true
        }
    },
    {
        collection: 'UsageLogs'
    }
);

// ✅ Indexes για γρήγορες αναζητήσεις
usageLogSchema.index({ userId: 1, date: 1 });
usageLogSchema.index({ team: 1, date: 1 });
usageLogSchema.index({ userId: 1, logoutAt: 1 });
usageLogSchema.index({ sessionExpires: 1 }); // για το cleanup job

const UsageLogModel = model('UsageLog', usageLogSchema);
module.exports = UsageLogModel;
