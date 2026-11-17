'use strict';
const Profile = require('./employmentProfileContract');
const FIELD = 'employment_profile_fact_certification';
const VALUE = 'CERTIFIED_LEGACY_PERIOD_FACTS_V1';
function hasCertifiedHistoryBreakFacts(row = {}) {
    if (row[FIELD] !== VALUE || !Profile.readEmploymentProfile(row).recorded) return false;
    try {
        const from = Profile.calendarDate(row.hmeromhnia_isxyos_oron_ergasias_apo);
        const anchor = Profile.calendarDate(row.hmeromhnia_isxyos_dialleimatos_apo);
        return Boolean(from && anchor && from.getTime() === anchor.getTime());
    } catch { return false; }
}
module.exports = { FIELD, VALUE, hasCertifiedHistoryBreakFacts };
