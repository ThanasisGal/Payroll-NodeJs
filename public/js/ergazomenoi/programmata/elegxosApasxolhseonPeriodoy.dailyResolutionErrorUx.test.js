'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function employmentReviewErrorEscapeHtml');
const end = source.indexOf('const employmentReviewSwalCommonClasses');
assert.ok(start >= 0 && end > start);

const sandbox = {
    reviewTimeToMinute(value) {
        const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(String(value || ''));
        if (!match) return null;
        const [hours, minutes] = String(value).split(':').map(Number);
        return hours * 60 + minutes;
    },
    minuteToReviewTime(value) {
        return `${String(Math.floor(value / 60)).padStart(2, '0')}:${
            String(value % 60).padStart(2, '0')}`;
    }
};
vm.createContext(sandbox);
vm.runInContext(`${source.slice(start, end)};this.details=employmentReviewUserErrorDetails;`,
    sandbox);

const stale = sandbox.details({ code: 'HR_DAILY_PREVIEW_STALE',
    message: 'Τα δεδομένα της ημέρας ή του διαλείμματος άλλαξαν. Δημιουργήστε νέα προεπισκόπηση.' });
assert.equal(stale.title, 'Δεν έγινε η αποθήκευση');
assert.match(stale.html, /Προσπαθήσατε να αποθηκεύσετε τις πραγματικές ώρες/);
assert.match(stale.html, /Για λόγους ασφάλειας η αλλαγή σταμάτησε/);
assert.match(stale.html, /Πατήστε ξανά «Αποθήκευση»/);
assert.match(stale.html, /Ακριβή επιβεβαίωση ημέρας/);
assert.match(stale.html, /Καμία αλλαγή δεν αποθηκεύτηκε/);
assert.match(stale.html, /Κωδικός αναφοράς: HR_DAILY_PREVIEW_STALE/);
assert.doesNotMatch(stale.html, /fingerprint|stale state|CAS|payload|resolver|MongoDB|HTTP/i);
assert.notEqual(stale.html,
    'Τα δεδομένα της ημέρας ή του διαλείμματος άλλαξαν. Δημιουργήστε νέα προεπισκόπηση.');

const required = sandbox.details({ code: 'HR_DAILY_PREVIEW_REQUIRED' });
assert.equal(required.title, 'Δεν έγινε η αποθήκευση');
assert.match(required.html, /χρειάζεται πρώτα έναν νέο ακριβή έλεγχο/);
assert.match(required.html, /Πατήστε ξανά «Αποθήκευση»/);
assert.match(required.html, /Καμία αλλαγή δεν αποθηκεύτηκε/);
assert.match(required.html, /Κωδικός αναφοράς: HR_DAILY_PREVIEW_REQUIRED/);

const overlap = sandbox.details({ code: 'HR_DAILY_WORK_LEAVE_OVERLAP' }, {
    dailyActualWorkCommand: {
        work_intervals: [{ start: '10:00', end: '13:00' }],
        emergency_hourly_leave_intervals: [{ apo_lepto: 750, eos_lepto: 840 }]
    }
});
assert.equal(overlap.title, 'Η εργασία και η ωροάδεια επικαλύπτονται');
assert.match(overlap.html, /Πραγματική εργασία: 10:00–13:00/);
assert.match(overlap.html, /Ωροάδεια: 12:30–14:00/);
assert.match(overlap.html, /12:30–13:00 δεν μπορεί να είναι ταυτόχρονα/);
assert.match(overlap.html, /Διορθώστε ένα από τα δύο διαστήματα/);
assert.match(overlap.html, /Καμία αλλαγή δεν αποθηκεύτηκε/);
assert.match(overlap.html, /Κωδικός αναφοράς: HR_DAILY_WORK_LEAVE_OVERLAP/);

const invalidCategory = sandbox.details({ code: 'HR_DAILY_LEAVE_CATEGORY_INVALID' }, {
    dailyActualWorkCommand: {
        emergency_hourly_leave_intervals: [{ apo_lepto: 831, eos_lepto: 840 }]
    }
});
assert.equal(invalidCategory.title, 'Η κατηγορία άδειας δεν μπορεί να χρησιμοποιηθεί');
assert.match(invalidCategory.html, /13:51–14:00/);
assert.match(invalidCategory.html, /Επιλέξτε άλλη κατηγορία/);
assert.match(invalidCategory.html, /Καμία αλλαγή δεν αποθηκεύτηκε/);
assert.match(invalidCategory.html, /Κωδικός αναφοράς: HR_DAILY_LEAVE_CATEGORY_INVALID/);

const invalidClock = sandbox.details({ code: 'HR_DAILY_EMERGENCY_LEAVE_WTO_CLOCK_INVALID' });
assert.equal(invalidClock.title, 'Η ώρα της ωροάδειας δεν είναι έγκυρη');
assert.match(invalidClock.html, /24:00/);
assert.match(invalidClock.html, /00:00 έως 23:59/);
assert.match(invalidClock.html, /Καμία αλλαγή δεν αποθηκεύτηκε/);
assert.doesNotMatch(invalidClock.html, /WTOLeave/);

console.log('employment review daily-resolution error UX tests passed');
