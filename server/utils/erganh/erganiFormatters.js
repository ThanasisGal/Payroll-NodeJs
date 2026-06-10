function formatCurrencyForErgani(amount) {
    if (amount === null || amount === undefined || amount === '') return '0,00';

    let numeric;

    if (typeof amount === 'number') {
        numeric = amount;
    } else {
        const s = String(amount).trim();

        if (s.includes(',')) {
            numeric = Number(s.replace(/\./g, '').replace(',', '.'));
        } else {
            numeric = Number(s);
        }
    }

    if (!Number.isFinite(numeric)) return '0,00';

    return numeric.toFixed(2).replace('.', ',');
}

module.exports = {
    formatCurrencyForErgani
};
