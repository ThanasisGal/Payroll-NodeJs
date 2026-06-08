// =========================================================================
// ✅ ERGANI REST safety guard
// =========================================================================
// Χρήση σε scripts/controllers πριν από πραγματική REST υποβολή.
// Για να επιτραπεί υποβολή:
// ALLOW_ERGANI_SUBMIT=true node ...
//
// Χωρίς αυτό, παράγουμε payload/debug files αλλά ΔΕΝ στέλνουμε τίποτα.

function assertErganiSubmitAllowed(context = 'ERGANI REST submission') {
    const flag = String(process.env.ALLOW_ERGANI_SUBMIT || '').trim().toLowerCase();

    if (!['true', '1', 'yes'].includes(flag)) {
        const message =
            `${context} blocked. ` +
            'Για πραγματική υποβολή βάλε ALLOW_ERGANI_SUBMIT=true.';

        const error = new Error(message);
        error.code = 'ERGANI_SUBMIT_BLOCKED';
        throw error;
    }
}

function isErganiSubmitAllowed() {
    const flag = String(process.env.ALLOW_ERGANI_SUBMIT || '').trim().toLowerCase();
    return ['true', '1', 'yes'].includes(flag);
}

module.exports = {
    assertErganiSubmitAllowed,
    isErganiSubmitAllowed
};
