'use strict';

const crypto = require('crypto');
const { stableStringify } = require('./apasxoliseisStage3FingerprintService');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 50;
const DEFAULT_MAX_CACHED_SCOPES = 20000;
const MAX_SCOPES_PER_BATCH = 100;

function text(value) { return String(value ?? '').trim(); }
function canonicalScope(scope = {}) {
    return {
        team: text(scope.team),
        company_kod: text(scope.company_kod),
        ypokatasthma: text(scope.ypokatasthma),
        period_start: dateKeyUtc(scope.period_start),
        period_end: dateKeyUtc(scope.period_end),
        user_id: text(scope.user_id)
    };
}
function scopeKey(scope) { return stableStringify(canonicalScope(scope)); }
function entryKey(fingerprint, scope) {
    return `${fingerprint}:${crypto.createHash('sha256').update(scopeKey(scope)).digest('hex')}`;
}
function cacheError(code, statusCode, message) {
    return Object.assign(new Error(message), { code, statusCode });
}

class WeeklyHrStage2BulkStateCache {
    constructor({ ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES,
        maxCachedScopes = DEFAULT_MAX_CACHED_SCOPES,
        now = () => Date.now() } = {}) {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
        this.maxCachedScopes = maxCachedScopes;
        this.now = now;
        this.entries = new Map();
    }

    put({ preview, scope }) {
        const fingerprint = text(preview?.preview_fingerprint);
        if (!fingerprint) return null;
        const entry = { createdAt: this.now(), scope: canonicalScope(scope),
            safeScopes: Array.isArray(preview.safe_scope_ids) ? preview.safe_scope_ids : [],
            exceptions: Array.isArray(preview._all_exceptions) ? preview._all_exceptions : [],
            pageSize: Math.min(50, Number(preview.exception_page_size) || 50) };
        const key = entryKey(fingerprint, entry.scope);
        this.entries.delete(key);
        this.entries.set(key, entry);
        const cachedScopeCount = () => [...this.entries.values()].reduce((total, item) =>
            total + item.safeScopes.length + item.exceptions.length, 0);
        while (this.entries.size > this.maxEntries ||
            cachedScopeCount() > this.maxCachedScopes) {
            this.entries.delete(this.entries.keys().next().value);
        }
        return fingerprint;
    }

    requireEntry({ preview_fingerprint, scope }) {
        const fingerprint = text(preview_fingerprint);
        const key = entryKey(fingerprint, scope);
        const entry = this.entries.get(key);
        if (!entry || this.now() - entry.createdAt > this.ttlMs) {
            if (entry) this.entries.delete(key);
            const fingerprintExists = [...this.entries.keys()].some((candidate) =>
                candidate.startsWith(`${fingerprint}:`));
            if (fingerprintExists) throw cacheError('STAGE2_BULK_PREVIEW_SCOPE_MISMATCH', 403,
                'Η προεπισκόπηση δεν ανήκει στο ενεργό εταιρικό πλαίσιο.');
            throw cacheError('STAGE2_BULK_PREVIEW_EXPIRED', 409,
                'Η προεπισκόπηση έληξε. Εκτελέστε ξανά την αναζήτηση.');
        }
        return entry;
    }

    continuationToken(fingerprint, entry, offset) {
        return crypto.createHash('sha256').update(stableStringify({
            contract: 'weekly-hr-stage2-continuation:v1', fingerprint,
            scope: entry.scope, offset
        })).digest('hex');
    }

    batch({ preview_fingerprint, continuation_token = '', scope,
        batch_size = MAX_SCOPES_PER_BATCH }) {
        const fingerprint = text(preview_fingerprint);
        const entry = this.requireEntry({ preview_fingerprint: fingerprint, scope });
        const size = Math.max(1, Math.min(MAX_SCOPES_PER_BATCH,
            Number(batch_size) || MAX_SCOPES_PER_BATCH));
        let offset = 0;
        const supplied = text(continuation_token);
        if (supplied) {
            let found = false;
            for (let candidate = size; candidate <= entry.safeScopes.length; candidate += size) {
                if (this.continuationToken(fingerprint, entry, candidate) === supplied) {
                    offset = candidate; found = true; break;
                }
            }
            if (!found) throw cacheError('STAGE2_BULK_CONTINUATION_INVALID', 409,
                'Η συνέχεια της μαζικής ενημέρωσης δεν είναι πλέον έγκυρη.');
        }
        const scopes = entry.safeScopes.slice(offset, offset + size);
        const nextOffset = offset + scopes.length;
        const remaining = Math.max(0, entry.safeScopes.length - nextOffset);
        return { scopes, offset, processed_in_batch: scopes.length, remaining,
            has_more: remaining > 0, continuation_token: remaining > 0
                ? this.continuationToken(fingerprint, entry, nextOffset) : null,
            total_safe_scopes: entry.safeScopes.length,
            skipped_manual: offset === 0 ? entry.exceptions.length : 0 };
    }

    exceptionPage({ preview_fingerprint, scope, exception_page = 1 }) {
        const entry = this.requireEntry({ preview_fingerprint, scope });
        const page = Math.max(1, Number(exception_page) || 1);
        const offset = (page - 1) * entry.pageSize;
        return { exceptions: entry.exceptions.slice(offset, offset + entry.pageSize),
            exception_page: page, exception_page_size: entry.pageSize,
            exception_page_count: Math.max(1,
                Math.ceil(entry.exceptions.length / entry.pageSize)) };
    }
}

module.exports = { DEFAULT_TTL_MS, DEFAULT_MAX_ENTRIES, DEFAULT_MAX_CACHED_SCOPES,
    MAX_SCOPES_PER_BATCH,
    canonicalScope, WeeklyHrStage2BulkStateCache };
