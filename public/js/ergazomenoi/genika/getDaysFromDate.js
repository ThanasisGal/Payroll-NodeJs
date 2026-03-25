document.addEventListener('DOMContentLoaded', function () {
    const allaghInputApo = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
    const allaghInputEos = document.getElementById('hmeromhnia_allaghs_orarioy_eos');

    allaghInputApo.addEventListener('input', function () {
        updateDateFieldFrom(allaghInputApo, allaghInputEos);
    });

    allaghInputEos.addEventListener('input', function () {
        updateDates();
    });

    updateDates();
});

function updateDateFieldFrom(sourceInput, targetInput) {
    const dateValue = new Date(sourceInput.value);
    if (isValidDate(dateValue)) {
        targetInput.value = sourceInput.value;
        updateDates();
    }
}

// ✅ ΝΕΟΣ Helper: Μετατροπή Date σε "YYYY-MM-DD" χωρίς timezone offset
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ✅ ΝΕΟΣ Helper: Parse "YYYY-MM-DD" ως local date (όχι UTC)
function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // Local time, ΟΧΙ UTC
}

function updateDates() {
    const baseDateInput = document.getElementById('hmeromhnia_allaghs_orarioy_apo');
    if (!baseDateInput.value) {
        return;
    }

    // ✅ Parse ως local date (ΟΧΙ UTC)
    const baseDate = parseLocalDate(baseDateInput.value);

    // ✅ ΜΟΝΟ τα .input-date μέσα στο #dynamicFields
    const dateInputs = document.querySelectorAll('#dynamicFields .input-date');

    // Reset existing values
    dateInputs.forEach((input, index) => {
        input.value = '';
        input.style.color = '';
        const checkboxId = `argia_${input.id.match(/\d+/)[0].padStart(2, '0')}`;
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) checkbox.checked = false;

        const dayLabelId = `day_label_${String(index + 1).padStart(2, '0')}`;
        const dayLabelElement = document.getElementById(dayLabelId);
        if (dayLabelElement) {
            dayLabelElement.style.color = '';
            dayLabelElement.textContent = '';
        }

        const holidayId = `perigrafh_argias_${String(index + 1).padStart(2, '0')}`;
        const holidayElement = document.getElementById(holidayId);
        if (holidayElement) {
            holidayElement.style.color = '';
            holidayElement.value = '';
        }
    });

    // ✅ Update new dates and labels
    dateInputs.forEach((input, index) => {
        let newDate = new Date(baseDate);
        newDate.setDate(newDate.getDate() + index);

        // ✅ formatLocalDate αντί για toISOString() → Δεν επηρεάζεται από DST!
        input.value = formatLocalDate(newDate);

        const dayLabelElement = document.getElementById(
            `day_label_${String(index + 1).padStart(2, '0')}`
        );
        if (dayLabelElement) {
            dayLabelElement.textContent = getDayLabel(newDate.getDay());
            dayLabelElement.style.color = 'black';
        }
    });

    checkForHolidays();
}

function getDayLabel(dayIndex) {
    const days = ['Κυ', 'Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα'];
    return days[dayIndex];
}

function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

async function checkForHolidays() {
    // ✅ ΜΟΝΟ τα .input-date μέσα στο #dynamicFields
    const dates = Array.from(document.querySelectorAll('#dynamicFields .input-date')).map(
        (input) => {
            // ✅ Parse ως local date (ΟΧΙ UTC)
            const date = parseLocalDate(input.value);
            date.setUTCHours(0, 0, 0, 0);
            return date.toISOString().replace('.000Z', '.000+00:00');
        }
    );

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

    if (!csrfToken) {
        console.error('❌ CSRF token not found!');
        throw new Error('CSRF token missing. Please refresh the page.');
    }

    const response = await fetch('/api/checkArgies', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': csrfToken,
            'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ dates })
    });

    const holidays = await response.json();

    // ✅ ΜΟΝΟ τα .input-date μέσα στο #dynamicFields
    document.querySelectorAll('#dynamicFields .input-date').forEach((input) => {
        const date = parseLocalDate(input.value); // ✅ Local date
        const dayIndex = date.getDay(); // 0 = Κυριακή
        const foundHoliday = holidays.find((h) => h.date === input.value);

        const inputId = input.id;
        const dayLabelId = `day_label_${inputId.match(/\d+/)[0].padStart(2, '0')}`;
        const holidayId = `perigrafh_argias_${inputId.match(/\d+/)[0].padStart(2, '0')}`;
        const dayLabelElement = document.getElementById(dayLabelId);
        const holidayElement = document.getElementById(holidayId);

        if (foundHoliday) {
            input.style.color = 'red';
            if (dayLabelElement && holidayElement) {
                dayLabelElement.style.color = 'red';
                holidayElement.style.color = 'red';
                holidayElement.value = ` ( ${foundHoliday.description} )`;
                document.getElementById(
                    `argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`
                ).checked = true;
                document.getElementById(
                    `label-argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`
                ).textContent = 'ΝΑΙ';
            }
        } else if (dayIndex === 0) {
            // Κυριακή και όχι αργία
            input.style.color = '#db7500';
            if (dayLabelElement) {
                dayLabelElement.style.color = '#db7500';
            }
            document.getElementById(`argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`).checked =
                false;
            document.getElementById(
                `label-argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`
            ).textContent = 'ΟΧΙ';
        } else {
            input.style.color = 'black';
            if (dayLabelElement) {
                dayLabelElement.style.color = 'black';
            }
            document.getElementById(`argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`).checked =
                false;
            document.getElementById(
                `label-argia_${inputId.match(/\d+/)[0].padStart(2, '0')}`
            ).textContent = 'ΟΧΙ';
        }
    });
}
