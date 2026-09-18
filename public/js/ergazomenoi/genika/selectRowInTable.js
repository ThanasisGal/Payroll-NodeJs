// Επιλεγμένη γραμμή (id από data-id)
let selectedRowId = null;
let selectedRowDeparture = '';

function employeeTableScrollContainer() {
    return document.getElementById('myTable')?.closest('.overflow-auto') || null;
}

document.addEventListener('DOMContentLoaded', function () {
    const rows = document.querySelectorAll('#myTable tbody tr');
    // const btnSelect = document.getElementById("select-btn");
    const btnAdd = document.getElementById('add-btn');
    const table = document.getElementById('myTable');
    const header = document.getElementById('myTableHeader');
    const btnEdit = document.getElementById('edit-btn');
    const btnRehire = document.getElementById('rehire-btn');
    const btnDelete = document.getElementById('delete-btn');

    // Βάσεις URLs
    // const baseSelect = "/companies/genikastoixeia/select";
    const baseEdit = '/ergazomenoi/ergazomenoi/edit';
    const baseDelete = '/ergazomenoi/ergazomenoi/delete';

    // Αν λείπει data-allowed θεωρούμε επιτρεπτό
    const isAllowed = (el) => !el || el.dataset.allowed === undefined || el.dataset.allowed === '1';

    // Ενημέρωση hrefs με βάση την επιλογή & δικαιώματα
    const updateButtons = () => {
        // if (btnSelect) {
        //     btnSelect.href =
        //         selectedRowId && isAllowed(btnSelect) ? `${baseSelect}/${selectedRowId}` : "#";
        // }
        if (btnEdit) {
            btnEdit.href =
                selectedRowId && isAllowed(btnEdit) ? `${baseEdit}/${selectedRowId}` : '#';
        }
        if (btnRehire) {
            const closedRelationship = selectedRowId && Boolean(selectedRowDeparture);
            btnRehire.disabled = !isAllowed(btnRehire);
            btnRehire.classList.toggle('opacity-50', Boolean(selectedRowId && !closedRelationship));
            btnRehire.dataset.relationshipClosed = closedRelationship ? '1' : '0';
        }
        if (btnDelete) {
            btnDelete.href =
                selectedRowId && isAllowed(btnDelete) ? `${baseDelete}/${selectedRowId}` : '#';
        }
    };

    const bindGuardedNav = (btn, basePath) => {
        if (!btn) return;
        btn.addEventListener('click', async (e) => {
            if (!isAllowed(btn)) return;

            if (!selectedRowId) {
                e.preventDefault();
                e.stopPropagation();
                await Swal.fire({
                    backdrop: false, // overlay
                    allowOutsideClick: false,
                    title: 'Καμία επιλογή',
                    html: `Παρακαλώ επιλέξτε πρώτα έναν εργαζόμενο από τον πίνακα.`,
                    icon: 'info',
                    showConfirmButton: true,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        title: 'custom-title',
                        popup: 'custom-swal-popup',
                        confirmButton: 'class-info custom-confirm-button custom-swal-button'
                    }
                });
                return;
            }

            if (basePath) {
                e.preventDefault();
                location.href = departureUrl(`${basePath}/${selectedRowId}`);
            }
        });
    };

    function departureUrl(path) {
        return window.EmployeeTableReturn?.begin(path, selectedRowId,
            employeeTableScrollContainer()?.scrollTop,
            window.TableSort?.getSortState(table, header)) || path;
    }
    if (btnAdd) btnAdd.addEventListener('click', event => {
        if (!isAllowed(btnAdd)) return;
        event.preventDefault();
        location.href = departureUrl('/ergazomenoi/ergazomenoi/add');
    });

    // Επιλογή/αποεπιλογή γραμμών (μία ενεργή)
    rows.forEach((row) => {
        row.addEventListener('click', function () {
            const wasSelected = this.classList.contains('selected-row');
            rows.forEach((r) => r.classList.remove('selected-row'));
            if (wasSelected) {
                selectedRowId = null;
                selectedRowDeparture = '';
            } else {
                this.classList.add('selected-row');
                selectedRowId = this.getAttribute('data-id') || null;
                selectedRowDeparture = this.getAttribute('data-departure') || '';
            }
            updateButtons();
        });
    });

    const nextDateKey = (dateKey) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return '';
        const date = new Date(`${dateKey}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime())) return '';
        date.setUTCDate(date.getUTCDate() + 1);
        return date.toISOString().slice(0, 10);
    };

    const displayDateKey = (dateKey) => {
        const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? `${match[3]}/${match[2]}/${match[1]}` : String(dateKey || '');
    };

    if (btnRehire) {
        btnRehire.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!isAllowed(btnRehire)) return;

            if (!selectedRowId) {
                await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    title: 'Καμία επιλογή',
                    text: 'Παρακαλώ επιλέξτε πρώτα έναν εργαζόμενο από τον πίνακα.',
                    icon: 'info',
                    confirmButtonText: 'Κλείσιμο'
                });
                return;
            }

            const minRehireDate = nextDateKey(selectedRowDeparture);
            if (!minRehireDate) {
                await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    title: 'Δεν υπάρχει ημερομηνία αποχώρησης',
                    text: 'Για να γίνει επαναπρόσληψη πρέπει να υπάρχει καταχωρημένη ημερομηνία αποχώρησης από την προηγούμενη απασχόληση.',
                    icon: 'warning',
                    confirmButtonText: 'Κλείσιμο'
                });
                return;
            }

            const prompt = await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                title: 'Επαναπρόσληψη εργαζομένου',
                text: `Η προηγούμενη απασχόληση έληξε στις ${displayDateKey(selectedRowDeparture)}. Επιλέξτε την ημερομηνία της νέας πρόσληψης. Στο επόμενο βήμα θα ελέγξετε και θα συμπληρώσετε τα στοιχεία της νέας πρόσληψης. Δεν θα αποθηκευτεί κάτι σε αυτό το βήμα.`,
                icon: 'info',
                input: 'date',
                inputAttributes: { min: minRehireDate },
                didOpen: () => {
                    const dateInput = Swal.getInput();
                    if (dateInput) {
                        dateInput.style.width = '17rem';
                        dateInput.style.maxWidth = 'calc(100% - 2rem)';
                        dateInput.style.marginLeft = 'auto';
                        dateInput.style.marginRight = 'auto';
                    }

                    const confirmButton = Swal.getConfirmButton();
                    if (confirmButton) {
                        confirmButton.style.width = 'auto';
                        confirmButton.style.minWidth = '8rem';
                        confirmButton.style.whiteSpace = 'nowrap';
                    }
                },
                inputValidator: (value) => {
                    if (!value) return 'Η ημερομηνία επαναπρόσληψης είναι υποχρεωτική.';
                    if (value < minRehireDate) {
                        return `Η ημερομηνία πρέπει να είναι από ${displayDateKey(minRehireDate)} και μετά.`;
                    }
                    return undefined;
                },
                showCancelButton: true,
                confirmButtonText: 'Συνέχεια',
                cancelButtonText: 'Ακύρωση',
                focusCancel: true,
                customClass: {
                    title: 'custom-title',
                    popup: 'custom-swal-popup',
                    htmlContainer: 'custom-html-container',
                    confirmButton: 'class-success custom-confirm-button custom-swal-button',
                    cancelButton: 'custom-cancel-button custom-swal-button'
                }
            });

            if (!prompt.isConfirmed) return;

            const target =
                `${baseEdit}/${selectedRowId}?rehire=1&rehireDate=${encodeURIComponent(prompt.value)}`;
            location.href = departureUrl(target);
        });
    }

    // Ένας και μόνο handler για DELETE (CSP/CSRF-safe)
    if (btnDelete) {
        btnDelete.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!isAllowed(btnDelete)) return;

            if (!selectedRowId) {
                await Swal.fire({
                    backdrop: false, // overlay
                    allowOutsideClick: false,
                    title: 'Καμία επιλογή',
                    html: `Παρακαλώ επιλέξτε πρώτα έναν εργαζόμενο από τον πίνακα.`,
                    icon: 'info',
                    showConfirmButton: true,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        title: 'custom-title',
                        popup: 'custom-swal-popup',
                        confirmButton: 'class-info custom-confirm-button custom-swal-button'
                    }
                });
                return;
            }

            const result = await Swal.fire({
                backdrop: false, // overlay
                allowOutsideClick: false,
                title: 'Είστε σίγουρος/η;',
                html: `ΠΡΟΣΟΧΗ!<br>Δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια.
                    Με τη διαγραφή του εργαζόμενου θα διαγραφούν (από όλα τα αρχεία) οι εγγραφές που τον αφορούν.`,
                icon: 'warning',
                showConfirmButton: true,
                showCancelButton: true,
                focusCancel: true,
                confirmButtonText: 'Διαγραφή',
                cancelButtonText: 'Ακύρωση',
                customClass: {
                    title: 'custom-title',
                    popup: 'custom-swal-popup',
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                    cancelButton: 'custom-cancel-button custom-swal-button'
                },
                didOpen: () => Swal.getCancelButton()?.focus()
            });
            if (!result.isConfirmed) {
                window.AppLoader.hide();
                return;
            }

            // URL από το href (έχει ήδη .../${selectedRowId})
            const url = btnDelete.href;
            const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';

            try {
                const resp = await fetch(url, {
                    method: 'DELETE', // <-- Ταιριάζει στο route σου
                    headers: {
                        'CSRF-Token': csrf, // ✅ για csurf
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include' // ✅ στείλε session cookies
                });

                // auto-follow redirect
                if (resp.redirected && resp.url) {
                    await Swal.fire({
                        backdrop: false, // overlay
                        allowOutsideClick: false,
                        title: 'Επιτυχής διαγραφή',
                        timer: 1200,
                        icon: 'success',
                        showConfirmButton: false,
                        customClass: {
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    });
                    location.href = resp.url;
                    return;
                }

                // 3xx χωρίς auto-follow
                if (resp.status >= 300 && resp.status < 400) {
                    const loc = resp.headers.get('Location') || resp.headers.get('location');
                    if (loc) {
                        await Swal.fire({
                            backdrop: false, // overlay
                            allowOutsideClick: false,
                            title: 'Επιτυχής διαγραφή',
                            timer: 1200,
                            icon: 'success',
                            showConfirmButton: false,
                            customClass: {
                                title: 'custom-title',
                                popup: 'custom-swal-popup'
                            }
                        });
                        location.href = loc.startsWith('http')
                            ? loc
                            : new URL(loc, location.origin).toString();
                        return;
                    }
                    throw new Error(`Redirect ${resp.status} χωρίς Location header`);
                }

                // CSRF/Forbidden
                if (resp.status === 403) {
                    const t = await resp.text().catch(() => '');
                    throw new Error('CSRF/Forbidden (403). ' + t.slice(0, 120));
                }

                // 204 No Content
                if (resp.status === 204) {
                    await Swal.fire({
                        backdrop: false, // overlay
                        allowOutsideClick: false,
                        title: 'Επιτυχής διαγραφή',
                        timer: 1200,
                        icon: 'success',
                        showConfirmButton: false,
                        customClass: {
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    });

                    location.href = '/ergazomenoi/ergazomenoi';
                    return;
                }

                // JSON απάντηση
                const ct = resp.headers.get('content-type') || '';
                if (ct.includes('application/json')) {
                    const data = await resp.json();
                    if (!resp.ok || data?.success === false) {
                        throw new Error(`HTTP ${resp.status} / success=${data?.success}`);
                    }
                    await Swal.fire({
                        backdrop: false, // overlay
                        allowOutsideClick: false,
                        title: 'Επιτυχής διαγραφή',
                        timer: 1200,
                        icon: 'success',
                        showConfirmButton: false,
                        customClass: {
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    });
                    location.href = data.redirectUrl || '/ergazomenoi/ergazomenoi';
                    return;
                }

                // Άλλος content-type αλλά OK (π.χ. HTML)
                if (resp.ok) {
                    await Swal.fire({
                        backdrop: false, // overlay
                        allowOutsideClick: false,
                        title: 'Επιτυχής διαγραφή',
                        timer: 1200,
                        icon: 'success',
                        showConfirmButton: false,
                        customClass: {
                            title: 'custom-title',
                            popup: 'custom-swal-popup'
                        }
                    });
                    location.href = '/ergazomenoi/ergazomenoi';
                    return;
                }

                throw new Error(`HTTP error ${resp.status}`);
            } catch (error) {
                await Swal.fire({
                    backdrop: false, // overlay
                    allowOutsideClick: false,
                    icon: 'error',
                    title: 'Σφάλμα κατά τη διαγραφή',
                    html: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>«Επικοινωνία»</strong>.<br><small>${String(error?.message || error)}</small>`,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        title: 'custom-title',
                        popup: 'custom-swal-popup',
                        confirmButton: 'class-normal custom-confirm-button custom-swal-button'
                    },
                    willClose: () => {
                        window.location.href = '/ergazomenoi/ergazomenoi'; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
                    }
                });
            }
        });
    }

    // bindGuardedNav(btnSelect, baseSelect);
    bindGuardedNav(btnEdit, baseEdit);

    let restoring = false;
    function restore(persisted = false) {
        if (restoring) return;
        const state = window.EmployeeTableReturn?.returning(persisted);
        if (state?.redirected) return;
        if (!state) { updateButtons(); return; }
        restoring = true;
        // Reorder first. Row identity, never a position/index, drives selection.
        if (state.sort) window.TableSort?.applySortState(table, header, state.sort);
        rows.forEach(row => row.classList.remove('selected-row'));
        const selected = [...rows].find(row => state.employeeId && row.getAttribute('data-id') === state.employeeId);
        selectedRowId = selected ? state.employeeId : null;
        selectedRowDeparture = selected ? selected.getAttribute('data-departure') || '' : '';
        selected?.classList.add('selected-row');
        updateButtons();
        // Let layout and browser history scroll restoration finish before our scroll.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const container = employeeTableScrollContainer();
            if (container && Number.isFinite(state.scrollTop) && state.scrollTop >= 0) {
                container.scrollTop = state.scrollTop;
            }
            window.EmployeeTableReturn.clear(state.token);
            restoring = false;
        }));
    }
    restore();
    window.addEventListener('pageshow', event => { if (event.persisted) restore(true); });
});
