// =========================================================================
// ✅ ERGANI REST submission codes
// =========================================================================
// Κρατάμε τους ids συγκεντρωμένους εδώ, για να μη γίνονται hardcode
// σε controllers/generators. Ο REST uploader μπορεί να δουλεύει με code
// π.χ. WebE3N, αλλά οι ids είναι χρήσιμοι για compare/debug scripts.

const ERGANI_SUBMISSIONS = Object.freeze({
    WebE3N: {
        code: 'WebE3N',
        description: 'ΨΗΦΙΑΚΗ ΑΝΑΓΓΕΛΙΑ ΕΝΑΡΞΗΣ ΕΡΓΑΣΙΑΣ - Πρόσληψη',
        trial: 93,
        production: 213
    },
    WebE7N: {
        code: 'WebE7N',
        description: 'Λήξη σύμβασης ορισμένου χρόνου',
        trial: 111,
        production: 222
    }
});

function getErganiSubmissionId(code, env = process.env.ERGANI_ENV || 'trial') {
    const item = ERGANI_SUBMISSIONS[code];
    if (!item) {
        throw new Error(`Άγνωστο ERGANI submission code: ${code}`);
    }

    const normalizedEnv = String(env).trim().toLowerCase();
    return normalizedEnv === 'production' || normalizedEnv === 'prod'
        ? item.production
        : item.trial;
}

module.exports = {
    ERGANI_SUBMISSIONS,
    getErganiSubmissionId
};
