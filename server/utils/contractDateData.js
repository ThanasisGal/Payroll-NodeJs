'use strict';

class ContractDateValidationError extends Error {
    constructor(code, message, field) {
        super(message);
        this.name = 'ContractDateValidationError';
        this.code = code;
        this.field = field;
        this.statusCode = 409;
    }
}

function invalidDate(field) {
    throw new ContractDateValidationError(
        'CONTRACT_DATE_INVALID',
        `Η ημερομηνία ${field} της σύμβασης δεν είναι έγκυρη. Δεν δημιουργήθηκε PDF σύμβασης.`,
        field
    );
}

function calendarParts(value, field) {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) invalidDate(field);
        return {
            year: value.getUTCFullYear(),
            month: value.getUTCMonth() + 1,
            day: value.getUTCDate()
        };
    }

    const text = String(value).trim();
    let match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(text);
    let parts = match
        ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
        : null;

    if (!parts) {
        match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
        parts = match
            ? { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) }
            : null;
    }

    if (!parts) invalidDate(field);

    const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    if (
        check.getUTCFullYear() !== parts.year ||
        check.getUTCMonth() + 1 !== parts.month ||
        check.getUTCDate() !== parts.day
    ) {
        invalidDate(field);
    }

    return parts;
}

function dateKey(parts) {
    if (!parts) return null;
    return parts.year * 10000 + parts.month * 100 + parts.day;
}

function formatContractDate(value, field = 'ημερομηνία') {
    const parts = calendarParts(value, field);
    if (!parts) return '';
    return [parts.day, parts.month, parts.year]
        .map((part, index) => (index < 2 ? String(part).padStart(2, '0') : String(part)))
        .join('/');
}

function validateContractDateInvariants(ergazomenos) {
    const hire = calendarParts(ergazomenos?.hmeromhnia_proslhpshs, 'πρόσληψης');
    const contractChange = calendarParts(
        ergazomenos?.hmeromhnia_allaghs_symbashs,
        'αλλαγής σύμβασης'
    );
    const contractEnd = calendarParts(
        ergazomenos?.hmeromhnia_lhxhs_symbashs,
        'λήξης σύμβασης'
    );

    if (!contractEnd) return { hire, contractChange, contractEnd };

    if (!hire) {
        throw new ContractDateValidationError(
            'CONTRACT_HIRE_DATE_REQUIRED',
            'Δεν υπάρχει έγκυρη ημερομηνία πρόσληψης για τη σύμβαση ορισμένου χρόνου. Δεν δημιουργήθηκε PDF σύμβασης.',
            'hmeromhnia_proslhpshs'
        );
    }

    if (dateKey(contractEnd) < dateKey(hire)) {
        throw new ContractDateValidationError(
            'CONTRACT_END_BEFORE_HIRE',
            'Η ημερομηνία λήξης της σύμβασης προηγείται της ημερομηνίας πρόσληψης. Δεν δημιουργήθηκε PDF σύμβασης.',
            'hmeromhnia_lhxhs_symbashs'
        );
    }

    if (contractChange && dateKey(contractEnd) < dateKey(contractChange)) {
        throw new ContractDateValidationError(
            'CONTRACT_END_BEFORE_CHANGE',
            'Η ημερομηνία λήξης της σύμβασης προηγείται της ημερομηνίας αλλαγής σύμβασης. Δεν δημιουργήθηκε PDF σύμβασης.',
            'hmeromhnia_lhxhs_symbashs'
        );
    }

    return { hire, contractChange, contractEnd };
}

function calculateContractDateDifference(startDate, endDate) {
    const start = calendarParts(startDate, 'αλλαγής σύμβασης');
    const end = calendarParts(endDate, 'λήξης σύμβασης');
    if (!start || !end) return '';

    const daysInEndMonth = new Date(Date.UTC(end.year, end.month, 0)).getUTCDate();
    const isStartFirstDay = start.day === 1;
    const isEndLastDay = end.day === daysInEndMonth;

    let calcDay = end.day;
    let calcMonth = end.month;
    let calcYear = end.year;

    if (isStartFirstDay && isEndLastDay) {
        const nextMonth = new Date(Date.UTC(end.year, end.month, 1));
        calcDay = 1;
        calcMonth = nextMonth.getUTCMonth() + 1;
        calcYear = nextMonth.getUTCFullYear();
    }

    let years = calcYear - start.year;
    let months = calcMonth - start.month;
    let days = calcDay - start.day;

    if (days < 0) {
        months--;
        days += new Date(Date.UTC(calcYear, calcMonth - 1, 0)).getUTCDate();
    }

    if (months < 0) {
        years--;
        months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'έτους' : 'ετών'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'μηνός' : 'μηνών'}`);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'ημέρας' : 'ημερών'}`);
    return parts.join(', ');
}

function buildContractDateData(ergazomenos) {
    validateContractDateInvariants(ergazomenos);

    const hireDate = formatContractDate(
        ergazomenos?.hmeromhnia_proslhpshs,
        'πρόσληψης'
    );
    const contractEnd = formatContractDate(
        ergazomenos?.hmeromhnia_lhxhs_symbashs,
        'λήξης σύμβασης'
    );
    const durationText = contractEnd
        ? calculateContractDateDifference(
            ergazomenos?.hmeromhnia_allaghs_symbashs,
            ergazomenos?.hmeromhnia_lhxhs_symbashs
        )
        : '';

    return {
        _HMEROMHNIA_PROSLHPSHS: hireDate,
        _HMEROMHNIA_LHXHS_SYMBASHS: contractEnd,
        _DIARKEIA: durationText
            ? `, διάρκειας ${durationText} και η οποία λήγει την ${contractEnd}.`
            : '.',
        durationText
    };
}

module.exports = {
    ContractDateValidationError,
    buildContractDateData,
    calculateContractDateDifference,
    formatContractDate,
    validateContractDateInvariants
};
