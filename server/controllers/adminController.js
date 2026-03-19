const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs-extra');
const logger = require('../utils/logger');
const os = require('os');
const { pipeline } = require('stream/promises');

const Models_A = require('../models/stathera_arxeia');
const Models_B = require('../models/privileges');

const { ArgiesModel, PeriodsModel } = Models_A;

const { UserPrivilegesModel } = Models_B;

class adminController {
    static async anoigmaNeasXrhshs(req, res) {
        // ── Έλεγχος session ──────────────────────────────────────────────
        const companyKodikos = req.session?.companyKodikos;
        const YearInUse = req.session?.yearInUse;

        if (!companyKodikos || !YearInUse) {
            return res.status(400).json({
                success: false,
                message: 'Δεν βρέθηκαν τα απαραίτητα στοιχεία στο session.'
            });
        }

        const results = {
            argies: { inserted: 0, skipped: false },
            periods: { inserted: 0, skipped: false }
        };

        try {
            /* ============================================================
               ΒΗΜΑ 1 — ΑΡΓΙΕΣ
            ============================================================ */
            const existingArgies = await ArgiesModel.countDocuments({
                company_kod: companyKodikos,
                etos: YearInUse
            });

            if (existingArgies > 0) {
                // ✅ Υπάρχουν ήδη → skip, συνέχισε στο Βήμα 2
                logger.warn(
                    `anoigmaNeasXrhshs [Αργίες]: Υπάρχουν ήδη ${existingArgies} εγγραφές ` +
                        `για company_kod="${companyKodikos}", etos="${YearInUse}". Παράλειψη.`
                );
                results.argies.skipped = true;
                results.argies.existing = existingArgies;
            } else {
                // ✅ Δεν υπάρχουν → δημιούργησε
                const protypaArgies = await ArgiesModel.find({
                    company_kod: '0000',
                    etos: '0000'
                }).lean();

                if (!protypaArgies || protypaArgies.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message:
                            'Δεν βρέθηκαν πρότυπες εγγραφές Αργιών (company_kod="0000", etos="0000").'
                    });
                }

                const neasArgies = protypaArgies.map(({ _id, __v, ...rest }) => ({
                    ...rest,
                    company_kod: companyKodikos,
                    etos: YearInUse
                }));

                const insertedArgies = await ArgiesModel.insertMany(neasArgies, { ordered: true });

                results.argies.inserted = insertedArgies.length;
                logger.info(
                    `anoigmaNeasXrhshs [Αργίες]: Δημιουργήθηκαν ${insertedArgies.length} εγγραφές ` +
                        `για company_kod="${companyKodikos}", etos="${YearInUse}".`
                );
            }

            /* ============================================================
               ΒΗΜΑ 2 — PERIODS
            ============================================================ */
            const existingPeriods = await PeriodsModel.countDocuments({
                xrhsh: YearInUse
            });

            if (existingPeriods > 0) {
                // ✅ Υπάρχουν ήδη → skip
                logger.warn(
                    `anoigmaNeasXrhshs [Periods]: Υπάρχουν ήδη ${existingPeriods} εγγραφές ` +
                        `για xrhsh="${YearInUse}". Παράλειψη.`
                );
                results.periods.skipped = true;
                results.periods.existing = existingPeriods;
            } else {
                // ✅ Δεν υπάρχουν → δημιούργησε
                const protypaPeriods = await PeriodsModel.find({
                    xrhsh: '0000'
                }).lean();

                if (!protypaPeriods || protypaPeriods.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Δεν βρέθηκαν πρότυπες εγγραφές Periods (xrhsh="0000").',
                        results // ← στέλνει και το αποτέλεσμα των Αργιών
                    });
                }

                const fixDate = (date, newYear) => {
                    if (!date) return null;
                    const d = new Date(date);
                    d.setFullYear(parseInt(newYear, 10));
                    return d;
                };

                const neasPeriods = protypaPeriods.map(({ _id, __v, ...rest }) => ({
                    ...rest,
                    xrhsh: YearInUse,
                    apo: fixDate(rest.apo, YearInUse),
                    eos: fixDate(rest.eos, YearInUse)
                }));

                const insertedPeriods = await PeriodsModel.insertMany(neasPeriods, {
                    ordered: true
                });

                results.periods.inserted = insertedPeriods.length;
                logger.info(
                    `anoigmaNeasXrhshs [Periods]: Δημιουργήθηκαν ${insertedPeriods.length} εγγραφές ` +
                        `για xrhsh="${YearInUse}".`
                );
            }

            /* ============================================================
               ΤΕΛΟΣ — Αναλυτικό μήνυμα αποτελέσματος
            ============================================================ */
            const argiesMsg = results.argies.skipped
                ? `Αργίες: υπήρχαν ήδη ${results.argies.existing}`
                : `Αργίες: δημιουργήθηκαν ${results.argies.inserted}`;

            const periodsMsg = results.periods.skipped
                ? `Περίοδοι: υπήρχαν ήδη ${results.periods.existing}`
                : `Περίοδοι: δημιουργήθηκαν ${results.periods.inserted}`;

            return res.status(200).json({
                success: true,
                message: `Χρήση ${YearInUse} — ${argiesMsg} | ${periodsMsg}`,
                results
            });
        } catch (error) {
            logger.error('anoigmaNeasXrhshs Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Σφάλμα κατά τη δημιουργία αρχείων νέας χρήσης.',
                error: error.message
            });
        }
    }
}

module.exports = adminController;
