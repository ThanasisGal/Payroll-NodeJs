'use strict';

function extractForologikhKlimakaSuffix(value) {
    const normalized = String(value ?? '').trim();
    const match = normalized.match(/^(?:\d{4})?(\d{4})(?:\s*-\s*.*)?$/u);
    return match ? match[1] : null;
}

function buildForologikhKlimakaLookup(value, yearInUse) {
    const suffix = extractForologikhKlimakaSuffix(value);
    const xrhsh = String(yearInUse ?? '').trim();
    if (!suffix || !/^\d{4}$/.test(xrhsh)) return null;

    return {
        xrhsh,
        kodikos: suffix,
        suffix
    };
}

module.exports = {
    extractForologikhKlimakaSuffix,
    buildForologikhKlimakaLookup
};
