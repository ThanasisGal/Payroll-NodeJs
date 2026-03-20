const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs-extra');
const logger = require('../utils/logger');
const os = require('os');
const { pipeline } = require('stream/promises');

const Models_A = require('../models/stathera_arxeia');
const Models_B = require('../models/privileges');

const {
    ArgiesModel,
    EkptoshForoyModel,
    PeriodsModel,
    ForologikesKlimakesModel,
    Klimaka_ForoyModel,
    AsfalistikesKlaseisModel // ✅ Νέο
} = Models_A;

// const { UserPrivilegesModel } = Models_B;

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
            periods: { inserted: 0, skipped: false },
            ekptoshForoy: { inserted: 0, skipped: false },
            forologikesKlimakes: { inserted: 0, skipped: false },
            klimakaForoy: { inserted: 0, skipped: false },
            asfalistikesKlaseis: { inserted: 0, skipped: false } // ✅ Νέο
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
                logger.warn(
                    `anoigmaNeasXrhshs [Αργίες]: Υπάρχουν ήδη ${existingArgies} εγγραφές ` +
                        `για company_kod="${companyKodikos}", etos="${YearInUse}". Παράλειψη.`
                );
                results.argies.skipped = true;
                results.argies.existing = existingArgies;
            } else {
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
            const existingPeriods = await PeriodsModel.countDocuments({ xrhsh: YearInUse });

            if (existingPeriods > 0) {
                logger.warn(
                    `anoigmaNeasXrhshs [Periods]: Υπάρχουν ήδη ${existingPeriods} εγγραφές ` +
                        `για xrhsh="${YearInUse}". Παράλειψη.`
                );
                results.periods.skipped = true;
                results.periods.existing = existingPeriods;
            } else {
                const protypaPeriods = await PeriodsModel.find({ xrhsh: '0000' }).lean();

                if (!protypaPeriods || protypaPeriods.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Δεν βρέθηκαν πρότυπες εγγραφές Periods (xrhsh="0000").',
                        results
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
               ΒΗΜΑ 3 — ΕΚΠΤΩΣΗ ΦΟΡΟΥ
            ============================================================ */
            const existingEkptoshForoy = await EkptoshForoyModel.countDocuments({
                xrhsh: YearInUse
            });

            if (existingEkptoshForoy > 0) {
                logger.warn(
                    `anoigmaNeasXrhshs [EkptoshForoy]: Υπάρχουν ήδη ${existingEkptoshForoy} εγγραφές ` +
                        `για xrhsh="${YearInUse}". Παράλειψη.`
                );
                results.ekptoshForoy.skipped = true;
                results.ekptoshForoy.existing = existingEkptoshForoy;
            } else {
                const protypaEkptoshForoy = await EkptoshForoyModel.find({ xrhsh: '0000' }).lean();

                if (!protypaEkptoshForoy || protypaEkptoshForoy.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Δεν βρέθηκαν πρότυπες εγγραφές EkptoshForoy (xrhsh="0000").',
                        results
                    });
                }

                const neasEkptoshForoy = protypaEkptoshForoy.map(({ _id, __v, ...rest }) => ({
                    ...rest,
                    xrhsh: YearInUse
                }));

                const insertedEkptoshForoy = await EkptoshForoyModel.insertMany(neasEkptoshForoy, {
                    ordered: true
                });
                results.ekptoshForoy.inserted = insertedEkptoshForoy.length;
                logger.info(
                    `anoigmaNeasXrhshs [EkptoshForoy]: Δημιουργήθηκαν ${insertedEkptoshForoy.length} εγγραφές ` +
                        `για xrhsh="${YearInUse}".`
                );
            }

            /* ============================================================
               ΒΗΜΑ 4 — ΦΟΡΟΛΟΓΙΚΕΣ ΚΛΙΜΑΚΕΣ
            ============================================================ */
            const existingForologikesKlimakes = await ForologikesKlimakesModel.countDocuments({
                xrhsh: YearInUse
            });

            if (existingForologikesKlimakes > 0) {
                logger.warn(
                    `anoigmaNeasXrhshs [ForologikesKlimakes]: Υπάρχουν ήδη ${existingForologikesKlimakes} εγγραφές ` +
                        `για xrhsh="${YearInUse}". Παράλειψη.`
                );
                results.forologikesKlimakes.skipped = true;
                results.forologikesKlimakes.existing = existingForologikesKlimakes;
            } else {
                const protypaForologikesKlimakes = await ForologikesKlimakesModel.find({
                    xrhsh: '0000'
                }).lean();

                if (!protypaForologikesKlimakes || protypaForologikesKlimakes.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message:
                            'Δεν βρέθηκαν πρότυπες εγγραφές ForologikesKlimakes (xrhsh="0000").',
                        results
                    });
                }

                const neasForologikesKlimakes = protypaForologikesKlimakes.map(
                    ({ _id, __v, ...rest }) => ({
                        ...rest,
                        xrhsh: YearInUse
                    })
                );

                const insertedForologikesKlimakes = await ForologikesKlimakesModel.insertMany(
                    neasForologikesKlimakes,
                    { ordered: true }
                );
                results.forologikesKlimakes.inserted = insertedForologikesKlimakes.length;
                logger.info(
                    `anoigmaNeasXrhshs [ForologikesKlimakes]: Δημιουργήθηκαν ${insertedForologikesKlimakes.length} εγγραφές ` +
                        `για xrhsh="${YearInUse}".`
                );
            }

            /* ============================================================
               ΒΗΜΑ 5 — ΚΛΙΜΑΚΑ ΦΟΡΟΥ
            ============================================================ */
            const existingKlimakaForoy = await Klimaka_ForoyModel.countDocuments({
                xrhsh: YearInUse
            });

            if (existingKlimakaForoy > 0) {
                logger.warn(
                    `anoigmaNeasXrhshs [KlimakaForoy]: Υπάρχουν ήδη ${existingKlimakaForoy} εγγραφές ` +
                        `για xrhsh="${YearInUse}". Παράλειψη.`
                );
                results.klimakaForoy.skipped = true;
                results.klimakaForoy.existing = existingKlimakaForoy;
            } else {
                const protypaKlimakaForoy = await Klimaka_ForoyModel.find({
                    xrhsh: '0000'
                }).lean();

                if (!protypaKlimakaForoy || protypaKlimakaForoy.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Δεν βρέθηκαν πρότυπες εγγραφές KlimakaForoy (xrhsh="0000").',
                        results
                    });
                }

                const neasKlimakaForoy = protypaKlimakaForoy.map(({ _id, __v, ...rest }) => ({
                    ...rest,
                    xrhsh: YearInUse
                }));

                const insertedKlimakaForoy = await Klimaka_ForoyModel.insertMany(neasKlimakaForoy, {
                    ordered: true
                });
                results.klimakaForoy.inserted = insertedKlimakaForoy.length;
                logger.info(
                    `anoigmaNeasXrhshs [KlimakaForoy]: Δημιουργήθηκαν ${insertedKlimakaForoy.length} εγγραφές ` +
                        `για xrhsh="${YearInUse}".`
                );
            }

            /* ============================================================
               ΒΗΜΑ 6 — ΑΣΦΑΛΙΣΤΙΚΕΣ ΚΛΑΣΕΙΣ ✅ Νέο
            ============================================================ */
            const existingAsfalistikesKlaseis = await AsfalistikesKlaseisModel.countDocuments({
                etos: YearInUse
            });

            if (existingAsfalistikesKlaseis > 0) {
                logger.warn(
                    `anoigmaNeasXrhshs [AsfalistikesKlaseis]: Υπάρχουν ήδη ${existingAsfalistikesKlaseis} εγγραφές ` +
                        `για etos="${YearInUse}". Παράλειψη.`
                );
                results.asfalistikesKlaseis.skipped = true;
                results.asfalistikesKlaseis.existing = existingAsfalistikesKlaseis;
            } else {
                const protypaAsfalistikesKlaseis = await AsfalistikesKlaseisModel.find({
                    etos: '0000'
                }).lean();

                if (!protypaAsfalistikesKlaseis || protypaAsfalistikesKlaseis.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message:
                            'Δεν βρέθηκαν πρότυπες εγγραφές AsfalistikesKlaseis (etos="0000").',
                        results
                    });
                }

                const neasAsfalistikesKlaseis = protypaAsfalistikesKlaseis.map(
                    ({ _id, __v, ...rest }) => ({
                        ...rest,
                        etos: YearInUse
                    })
                );

                const insertedAsfalistikesKlaseis = await AsfalistikesKlaseisModel.insertMany(
                    neasAsfalistikesKlaseis,
                    { ordered: true }
                );
                results.asfalistikesKlaseis.inserted = insertedAsfalistikesKlaseis.length;
                logger.info(
                    `anoigmaNeasXrhshs [AsfalistikesKlaseis]: Δημιουργήθηκαν ${insertedAsfalistikesKlaseis.length} εγγραφές ` +
                        `για etos="${YearInUse}".`
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

            const ekptoshForoyMsg = results.ekptoshForoy.skipped
                ? `Έκπτωση Φόρου: υπήρχαν ήδη ${results.ekptoshForoy.existing}`
                : `Έκπτωση Φόρου: δημιουργήθηκαν ${results.ekptoshForoy.inserted}`;

            const forologikesKlimakesMsg = results.forologikesKlimakes.skipped
                ? `Φορολογικές Κατηγορίες: υπήρχαν ήδη ${results.forologikesKlimakes.existing}`
                : `Φορολογικές Κατηγορίες: δημιουργήθηκαν ${results.forologikesKlimakes.inserted}`;

            const klimakaForoyMsg = results.klimakaForoy.skipped
                ? `Κλίμακα Φόρου: υπήρχαν ήδη ${results.klimakaForoy.existing}`
                : `Κλίμακα Φόρου: δημιουργήθηκαν ${results.klimakaForoy.inserted}`;

            const asfalistikesKlaseisMsg = results.asfalistikesKlaseis.skipped
                ? `Ασφαλιστικές Κλάσεις: υπήρχαν ήδη ${results.asfalistikesKlaseis.existing}`
                : `Ασφαλιστικές Κλάσεις: δημιουργήθηκαν ${results.asfalistikesKlaseis.inserted}`;

            return res.status(200).json({
                success: true,
                message:
                    `Χρήση ${YearInUse} — ${argiesMsg} | ${periodsMsg} | ` +
                    `${ekptoshForoyMsg} | ${forologikesKlimakesMsg} | ${klimakaForoyMsg} | ` +
                    `${asfalistikesKlaseisMsg}`,
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
