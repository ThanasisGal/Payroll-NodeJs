'use strict';

function validateMaMutationDate(value) {
    const date = typeof value === 'string' ? value.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10) === date ? date : '';
}

module.exports = { validateMaMutationDate };
