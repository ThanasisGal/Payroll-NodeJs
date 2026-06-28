// ============================================================================
// getIstorikoOronErgasiasForPeriod.js
// ============================================================================
// Helper που φέρνει από τη ΒΔ τις ιστορικές εγγραφές όρων εργασίας
// για έναν εργαζόμενο και για συγκεκριμένη περίοδο υπολογισμού.
//
// Χρησιμοποιεί πρώτα τα νέα πεδία:
// - hmeromhnia_isxyos_oron_ergasias_apo
// - hmeromhnia_isxyos_oron_ergasias_eos
//
// και κάνει fallback στα παλιά πεδία ωραρίου μόνο για παλιά δεδομένα:
// - hmeromhnia_allaghs_orarioy_apo
// - hmeromhnia_allaghs_orarioy_eos
// ============================================================================

const mongoose = require('mongoose');
const { IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');

function normalizeDateOnly(value) {
    if (!value) return null;

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
        return null;
    }

    d.setHours(0, 0, 0, 0);
    return d;
}

function buildNewTermsDateRangeQuery(apo, eos) {
    return {
        // Νέα λογική: ημερομηνίες ισχύος όρων εργασίας.
        hmeromhnia_isxyos_oron_ergasias_apo: mongoose.trusted({
            $lte: eos
        }),
        $or: [
            {
                hmeromhnia_isxyos_oron_ergasias_eos: mongoose.trusted({
                    $gte: apo
                })
            },
            {
                // Σε MongoDB query, field: null καλύπτει και null και missing.
                // Έτσι αποφεύγουμε $exists:false που σε συνδυασμό με sanitize/casting
                // μπορεί να δώσει CastError σε Date πεδίο.
                hmeromhnia_isxyos_oron_ergasias_eos: null
            }
        ]
    };
}

function buildLegacyDateRangeQuery(apo, eos) {
    return {
        // Fallback μόνο για παλιές εγγραφές που δεν έχουν νέο apo ισχύος όρων.
        hmeromhnia_isxyos_oron_ergasias_apo: null,

        hmeromhnia_allaghs_orarioy_apo: mongoose.trusted({
            $lte: eos
        }),
        $or: [
            {
                hmeromhnia_allaghs_orarioy_eos: mongoose.trusted({
                    $gte: apo
                })
            },
            {
                // field:null καλύπτει null και missing χωρίς $exists:false.
                hmeromhnia_allaghs_orarioy_eos: null
            }
        ]
    };
}

async function getIstorikoOronErgasiasForPeriod({
    team,
    company_kod,
    kodikos,
    aa_eggrafhs,
    periodApo,
    periodEos
}) {
    const apo = normalizeDateOnly(periodApo);
    const eos = normalizeDateOnly(periodEos);

    if (!apo || !eos) {
        return [];
    }

    const query = {
        team,
        company_kod,

        // Αν το aa_eggrafhs είναι διαθέσιμο, είναι πιο ασφαλές.
        // Αν όχι, κρατάμε fallback με kodikos.
        ...(aa_eggrafhs
            ? { aa_eggrafhs: String(aa_eggrafhs).trim() }
            : { kodikos: String(kodikos || '').trim() }),

        // Θέλουμε μόνο εγγραφές που αφορούν αλλαγή όρων εργασίας.
        afora_allagh_oron_ergasias: true,

        // Εγγραφές που τέμνονται με την περίοδο payroll.
        // Πρώτα νέα πεδία ισχύος όρων, μετά fallback στα παλιά.
        $or: mongoose.trusted([
            buildNewTermsDateRangeQuery(apo, eos),
            buildLegacyDateRangeQuery(apo, eos)
        ])
    };

    const rows = await IstorikoProslhpseonAllagonModel.find(query)
        .sort({
            hmeromhnia_isxyos_oron_ergasias_apo: 1,
            hmeromhnia_allaghs_orarioy_apo: 1,
            createdAt: 1
        })
        .lean();

    return rows;
}

module.exports = {
    getIstorikoOronErgasiasForPeriod,
    normalizeDateOnly
};
