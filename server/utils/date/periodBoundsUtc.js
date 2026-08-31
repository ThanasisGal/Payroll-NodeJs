function buildPeriodBoundsUtc(year, periodCode) {
    const yearText = String(year);
    if (!/^[1-9]\d{3}$/.test(yearText)) {
        throw new TypeError('year must be a four-digit year from 1000 to 9999');
    }

    if (typeof periodCode !== 'string' || !/^(0[1-9]|1[0-2])$/.test(periodCode)) {
        throw new TypeError('periodCode must be a string from "01" to "12"');
    }

    const yearNumber = Number(yearText);
    const monthIndex = Number(periodCode) - 1;

    return {
        apo: new Date(Date.UTC(yearNumber, monthIndex, 1)),
        eos: new Date(Date.UTC(yearNumber, monthIndex + 1, 0))
    };
}

module.exports = { buildPeriodBoundsUtc };
