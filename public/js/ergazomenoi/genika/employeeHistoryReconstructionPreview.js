'use strict';

// This UI has exactly one GET and no reconstruction mutation/confirmation path.
document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('employeeHistoryReconstructionPreviewBtn');
    const modalElement = document.getElementById('employeeHistoryReconstructionPreviewModal');
    const body = document.getElementById('employeeHistoryReconstructionPreviewBody');
    const employee = document.getElementById('istorikoEmployeeId');
    if (!button || !modalElement || !body || !employee || !globalThis.bootstrap?.Modal) return;
    document.body.appendChild(modalElement);
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    let controller = null;
    let generation = 0;
    const escape = value => String(value ?? '').replace(/[&<>"']/g,
        char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const failureMessage = 'Ο έλεγχος του Ιστορικού δεν ολοκληρώθηκε. Δεν ήταν δυνατό να φορτωθεί η πρόταση. Δεν έχει αποθηκευτεί καμία αλλαγή.\n1. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.\n2. Αν το πρόβλημα παραμένει, συνδεθείτε ξανά ή επικοινωνήστε με τον διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-ΠΡΟΕΠ-05.';
    const confidenceClass = text => ({ 'Αυτόματο / Βέβαιο': 'certain', 'Κληρονομήθηκε': 'inherited',
        'Χρειάζεται Έλεγχο': 'assumed', 'Προεπιλογή': 'default' })[text] || 'assumed';
    function renderChanges(items) {
        const headings = ['Εγγραφή', 'Πεδίο', 'Πριν', 'Μετά', 'Πηγή', 'Βεβαιότητα'];
        return `<table class="history-preview-changes"><thead><tr>${headings.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${items.map(item => {
            const cells = [escape(item.row), escape(item.field), escape(item.before), escape(item.after),
                `${escape(item.source)}${item.sourceRow ? `<small>Εγγραφή ${escape(item.sourceRow)}</small>` : ''}`,
                `<span class="history-preview-badge history-preview-${confidenceClass(item.confidence)}">${escape(item.confidence)}</span>`];
            return `<tr>${cells.map((cell, index) => `<td data-label="${headings[index]}">${cell}</td>`).join('')}</tr>`;
        }).join('')}</tbody></table>`;
    }
    function lazyDetails(title, render) {
        const details = document.createElement('details');
        details.className = 'history-preview-details';
        const summary = document.createElement('summary');
        summary.textContent = title;
        details.appendChild(summary);
        details.addEventListener('toggle', () => {
            if (!details.open || details.childElementCount > 1) return;
            const content = document.createElement('div');
            content.className = 'history-preview-detail-content';
            const rendered = render();
            if (typeof rendered === 'string') content.innerHTML = rendered;
            else content.appendChild(rendered);
            details.appendChild(content);
        });
        return details;
    }
    function renderAttention(items) {
        return ['Ημερομηνίες', 'Αποδοχές', 'Σύμβαση', 'Ασφάλιση / ΚΠΚ', 'Λοιπά'].map(category => {
            const group = items.filter(item => (item.category || 'Λοιπά') === category);
            if (!group.length) return '';
            return `<section class="history-preview-attention-group"><h6>${category}</h6><ul>${group.map(item =>
                `<li>${item.conflict ? `<strong>${escape(item.field)}</strong><dl>
                    <div><dt>Υπάρχουσες τιμές</dt><dd>${item.conflict.values.map(escape).join(' / ')}</dd></div>
                    <div><dt>Πρόταση</dt><dd>${escape(item.conflict.proposed)}</dd></div></dl>
                    ${item.conflict.sourceRow ? `<small>Πηγή: Εγγραφή ${escape(item.conflict.sourceRow)}</small>` : ''}`
                    : `${item.field ? `<strong>${escape(item.field)}</strong> — ` : ''}${escape(item.message)}`}${item.rows?.length ? `<small>Εγγραφές: ${item.rows.map(escape).join(', ')}</small>` : ''}</li>`
            ).join('')}</ul></section>`;
        }).join('');
    }
    function renderPreview(preview) {
        body.replaceChildren();
        const summary = document.createElement('div');
        summary.className = 'history-preview-summary';
        const cards = [['Εγγραφές Ιστορικού', preview.summary.historyRows], ['Προτεινόμενες Περίοδοι', preview.summary.periods],
            ['Προτεινόμενες Αλλαγές', preview.summary.changes], ['Σημεία προς Έλεγχο', preview.summary.assumptions],
            ['Προειδοποιήσεις', preview.summary.warnings]];
        summary.innerHTML = cards.map(([label, count]) => `<div><strong>${escape(count)}</strong><span>${label}</span></div>`).join('');
        body.appendChild(summary);
        const message = document.createElement('p');
        message.className = preview.status === 'unavailable' ? 'alert alert-danger history-preview-message' : 'text-muted small history-preview-message';
        message.textContent = preview.message;
        if (preview.status === 'unavailable') body.appendChild(message);
        if (preview.attention.length) {
            const attention = lazyDetails('', () => renderAttention(preview.attention));
            attention.classList.add('history-preview-attention');
            attention.querySelector('summary').innerHTML = `<span>${escape(preview.attention.length)} ${preview.attention.length === 1 ? 'σημείο χρειάζεται' : 'σημεία χρειάζονται'} την προσοχή σας</span><span class="history-preview-detail-control">Προβολή λεπτομερειών</span>`;
            body.appendChild(attention);
        }
        function section(title) {
            const section = document.createElement('section');
            section.className = 'history-preview-section';
            const heading = document.createElement('h6');
            heading.textContent = title;
            section.appendChild(heading);
            body.appendChild(section);
            return section;
        }
        const proposed = section('1. Προτεινόμενες Περίοδοι');
        const periods = document.createElement('div');
        periods.className = 'history-preview-periods';
        periods.innerHTML = preview.periods.map(period => `<article class="history-preview-period"><h6>${escape(period.from)} → ${escape(period.to)}</h6>
            <p>Προέρχεται από τις εγγραφές: <strong>${period.rows.map(escape).join(', ')}</strong></p>
            ${period.rows.length > 1 ? `<p class="history-preview-period-explanation">Οι εγγραφές ${period.rows.map(escape).join(' και ')} φαίνεται να περιγράφουν την ίδια εργασιακή περίοδο και συνδυάστηκαν στην πρόταση.</p>` : ''}
            <dl class="history-preview-fields">${period.facts.map(field => `<div><dt>${escape(field.label)}</dt><dd>${escape(field.value)}</dd></div>`).join('')}</dl></article>`).join('');
        proposed.appendChild(periods);
        if (!preview.periods.length) proposed.append(preview.status === 'unavailable'
            ? 'Δεν δημιουργήθηκε πρόταση περιόδων. Ελέγξτε τα σημεία προσοχής.' : 'Δεν υπάρχουν περίοδοι προς εμφάνιση.');
        const changes = section('2. Προτεινόμενες Αλλαγές');
        if (preview.changes.length) {
            const table = document.createElement('div');
            table.className = 'history-preview-change-list';
            table.innerHTML = renderChanges(preview.changes);
            changes.appendChild(table);
        } else changes.append(preview.defaultGroups.length ? 'Οι προτεινόμενες αλλαγές αφορούν μόνο αριθμητικές προεπιλογές.' : 'Δεν προτείνονται αλλαγές.');
        if (preview.defaultGroups.length) {
            const defaults = lazyDetails(`${preview.summary.numericDefaults} αριθμητικά πεδία συμπληρώνονται με 0 — Προβολή λεπτομερειών`, () => {
                const groups = document.createElement('div');
                const explanation = document.createElement('p');
                explanation.textContent = 'Το 0 προτείνεται μόνο όταν δεν υπάρχει καλύτερο ιστορικό ή εφαρμόσιμο τρέχον στοιχείο. Δεν αποτελεί επιβεβαιωμένη αποδοχή ή ποσό.';
                groups.appendChild(explanation);
                for (const group of preview.defaultGroups) groups.appendChild(lazyDetails(
                    `Εγγραφή ${group.row} — ${group.count} αριθμητικές προεπιλογές`, () => renderChanges(group.changes)));
                return groups;
            });
            defaults.classList.add('history-preview-defaults');
            changes.appendChild(defaults);
        }
        const original = section('3. Υπάρχον Ιστορικό');
        original.classList.add('history-preview-original');
        const scheduleNote = document.createElement('p');
        scheduleNote.className = 'text-muted small';
        scheduleNote.textContent = 'Οι ημερομηνίες αλλαγής ωραρίου είναι πληροφοριακές και δεν χρησιμοποιούνται στην αυτόματη τακτοποίηση.';
        original.appendChild(scheduleNote);
        for (const row of preview.originalRows) {
            original.appendChild(lazyDetails(`Εγγραφή ${row.label} — Ισχύς Όρων Εργασίας: ${row.summary}`, () => {
                const groups = document.createElement('div');
                if (row.note) { const note = document.createElement('p'); note.textContent = row.note; groups.appendChild(note); }
                for (const group of row.groups) groups.appendChild(lazyDetails(group.title, () =>
                    `<dl class="history-preview-fields">${group.fields.map(field => `<div><dt>${escape(field.label)}${field.informational
                        ? `<small>${escape(field.note)}</small>` : ''}</dt><dd>${escape(field.value)}</dd></div>`).join('')}</dl>`));
                return groups;
            }));
        }
        if (!preview.originalRows.length) original.append('Δεν υπάρχουν εγγραφές Ιστορικού.');
        if (preview.status !== 'unavailable') body.appendChild(message);
    }
    button.addEventListener('click', async () => {
        if (controller) return;
        const requestGeneration = ++generation;
        controller = new AbortController();
        button.disabled = true;
        body.setAttribute('aria-busy', 'true');
        body.textContent = 'Γίνεται έλεγχος των αποθηκευμένων εγγραφών του Ιστορικού…';
        modal.show();
        try {
            const response = await fetch(`/api/ergazomenoi/${encodeURIComponent(employee.value)}/history-reconstruction-preview`,
                { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
            if (!response.ok || response.redirected) throw new Error('Preview unavailable');
            const payload = await response.json();
            if (!payload.success || !payload.preview) throw new Error('Preview unavailable');
            if (requestGeneration === generation) renderPreview(payload.preview);
        } catch (error) {
            if (error.name !== 'AbortError' && requestGeneration === generation) {
                body.replaceChildren();
                const message = document.createElement('p');
                message.className = 'alert alert-danger history-preview-message';
                message.textContent = failureMessage;
                body.appendChild(message);
            }
        } finally {
            if (requestGeneration === generation) {
                controller = null;
                button.disabled = false;
                body.removeAttribute('aria-busy');
            }
        }
    });
    modalElement.addEventListener('hide.bs.modal', () => {
        generation += 1;
        controller?.abort();
        controller = null;
        button.disabled = false;
        body.removeAttribute('aria-busy');
    });
    modalElement.addEventListener('hidden.bs.modal', () => {
        body.replaceChildren();
        button.focus();
    });
});
