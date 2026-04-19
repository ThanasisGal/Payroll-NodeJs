// document.addEventListener('DOMContentLoaded', () => {
//     const editBtn = document.getElementById('edit-btn');
//     if (!editBtn) return;

//     const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

//     // ✅ Βοηθητική: στέλνει ένα chunk και επιστρέφει stats
//     async function sendChunk(chunk, csrfToken) {
//         const response = await fetch('/api/enhmeroshKlimakion', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'CSRF-Token': csrfToken
//             },
//             credentials: 'include',
//             body: JSON.stringify(chunk)
//         });

//         if (!response.ok) {
//             throw new Error(`HTTP error ${response.status}`);
//         }

//         const ct = response.headers.get('content-type') || '';
//         if (ct.includes('application/json')) {
//             return await response.json();
//         }
//         return { success: true };
//     }
//     ``;

//     async function handleEditClick(event) {
//         event.preventDefault();
//         event.stopPropagation();

//         const allData = window.dataForUpdate ?? [];
//         if (!Array.isArray(allData) || allData.length === 0) {
//             await Swal.fire({
//                 backdrop: false,
//                 allowOutsideClick: false,
//                 icon: 'info',
//                 title: 'Δεν υπάρχουν δεδομένα',
//                 text: 'Δεν βρέθηκαν εγγραφές προς ενημέρωση.',
//                 showConfirmButton: true,
//                 confirmButtonText: 'Κλείσιμο',
//                 customClass: {
//                     confirmButton: 'class-info custom-confirm-button custom-swal-button',
//                     title: 'custom-title',
//                     popup: 'custom-swal-popup'
//                 }
//             });
//             return;
//         }

//         // ✅ Χωρισμός σε chunks
//         const CHUNK_SIZE = 1000;
//         const chunks = [];
//         for (let i = 0; i < allData.length; i += CHUNK_SIZE) {
//             chunks.push(allData.slice(i, i + CHUNK_SIZE));
//         }
//         const totalChunks = chunks.length;
//         const totalRecords = allData.length;

//         // ✅ Άνοιγμα Progress Bar SweetAlert2
//         Swal.fire({
//             backdrop: false,
//             allowOutsideClick: false,
//             title: 'Αποθήκευση κλιμακίων...',
//             html: `
//                 <div class="mb-2">
//                     Επεξεργασία εγγραφών: <b id="swal-done">0</b> / <b>${totalRecords}</b>
//                 </div>
//                 <div class="progress" style="height: 22px; border-radius: 8px;">
//                     <div
//                         id="swal-progress-bar"
//                         class="progress-bar progress-bar-striped progress-bar-animated bg-success"
//                         role="progressbar"
//                         style="width: 0%;"
//                         aria-valuenow="0"
//                         aria-valuemin="0"
//                         aria-valuemax="100">
//                         0%
//                     </div>
//                 </div>
//             `,
//             showConfirmButton: false,
//             didOpen: () => {
//                 Swal.showLoading();
//             }
//         });

//         try {
//             let totalModified = 0;
//             let totalUpserted = 0;
//             let processedRecords = 0;

//             // ✅ Παράλληλη επεξεργασία chunks (4 ταυτόχρονα)
//             const PARALLEL = 4;

//             for (let i = 0; i < chunks.length; i += PARALLEL) {
//                 const batch = chunks.slice(i, i + PARALLEL);

//                 const results = await Promise.all(
//                     batch.map((chunk) => sendChunk(chunk, csrfToken))
//                 );

//                 results.forEach((data, idx) => {
//                     const chunkSize = batch[idx].length;
//                     processedRecords += chunkSize;
//                     totalModified += data?.stats?.modified ?? 0;
//                     totalUpserted += data?.stats?.upserted ?? 0;
//                 });

//                 // ✅ Ενημέρωση Progress Bar
//                 const pct = Math.round((processedRecords / totalRecords) * 100);
//                 const bar = document.getElementById('swal-progress-bar');
//                 const lbl = document.getElementById('swal-done');
//                 if (bar) {
//                     bar.style.width = `${pct}%`;
//                     bar.textContent = `${pct}%`;
//                     bar.setAttribute('aria-valuenow', pct);
//                 }
//                 if (lbl) {
//                     lbl.textContent = processedRecords.toLocaleString('el-GR');
//                 }
//             }

//             // ✅ Επιτυχία
//             await Swal.fire({
//                 backdrop: false,
//                 allowOutsideClick: false,
//                 icon: 'success',
//                 title: 'Επιτυχής ενημέρωση!',
//                 html: `
//                     Ενημερώθηκαν: <b>${totalModified.toLocaleString('el-GR')}</b> εγγραφές<br>
//                     Νέες εγγραφές: <b>${totalUpserted.toLocaleString('el-GR')}</b>
//                 `,
//                 showConfirmButton: true,
//                 confirmButtonText: 'Κλείσιμο',
//                 customClass: {
//                     confirmButton: 'class-success custom-confirm-button custom-swal-button',
//                     title: 'custom-title',
//                     popup: 'custom-swal-popup'
//                 }
//             }).then(() => {
//                 window.location.href = '/symbaseis/ypologismosKlimakion';
//             });
//         } catch (err) {
//             await Swal.fire({
//                 backdrop: false,
//                 allowOutsideClick: false,
//                 icon: 'error',
//                 title: 'Αποτυχία ενημέρωσης κλιμακίων',
//                 text: String(err?.message || err),
//                 showConfirmButton: true,
//                 confirmButtonText: 'Κλείσιμο',
//                 customClass: {
//                     confirmButton: 'class-error custom-confirm-button custom-swal-button',
//                     title: 'custom-title',
//                     popup: 'custom-swal-popup'
//                 }
//             });
//         }
//     }

//     editBtn.addEventListener('click', handleEditClick);
// });

document.addEventListener('DOMContentLoaded', () => {
    const editBtn = document.getElementById('edit-btn');
    if (!editBtn) return;

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

    // ------------------------------
    // ΒΟΗΘΗΤΙΚΟ: Ενημέρωση Progress Bar (ίδιο pattern με ypologismos.js)
    // ------------------------------
    function updateProgress(processed, total, label) {
        const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
        const bar = document.getElementById('enhmr-progress-bar');
        const lbl = document.getElementById('enhmr-progress-label');
        const cnt = document.getElementById('enhmr-progress-count');
        if (bar) {
            bar.style.width = `${pct}%`;
            bar.textContent = `${pct}%`;
            bar.setAttribute('aria-valuenow', pct);
        }
        if (lbl && label) lbl.textContent = label;
        if (cnt) cnt.textContent = processed.toLocaleString('el-GR');
    }

    function openProgressSwal(totalRecords) {
        Swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            title: 'Αποθήκευση κλιμακίων...',
            html: `
                <div id="enhmr-progress-label" class="mb-2 fsvw-1_0">
                    Αρχικοποίηση...
                </div>
                <div class="mb-2">
                    Επεξεργασία εγγραφών:
                    <b id="enhmr-progress-count">0</b> / <b>${totalRecords.toLocaleString('el-GR')}</b>
                </div>
                <div class="progress" style="height: 22px; border-radius: 8px;">
                    <div
                        id="enhmr-progress-bar"
                        class="progress-bar progress-bar-striped progress-bar-animated bg-success"
                        role="progressbar"
                        style="width: 0%;"
                        aria-valuenow="0"
                        aria-valuemin="0"
                        aria-valuemax="100">
                        0%
                    </div>
                </div>
            `,
            showConfirmButton: false,
            didOpen: () => Swal.hideLoading() // ✅ Εξαναγκάζει απόκρυψη loader
        });
    }

    // ------------------------------
    // Στέλνει ένα chunk στον server
    // ------------------------------
    async function sendChunk(chunk) {
        const response = await fetch('/api/enhmeroshKlimakion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            credentials: 'include',
            skipLoader: true, // ✅ παρακάμπτει τον global AppLoader
            body: JSON.stringify(chunk)
        });

        if (!response.ok) throw new Error(`HTTP error ${response.status}`);

        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) return await response.json();
        return { success: true };
    }

    // ------------------------------
    // ΚΥΡΙΑ ΛΟΓΙΚΗ
    // ------------------------------
    async function handleEditClick(event) {
        event.preventDefault();
        event.stopPropagation();

        const allData = window.dataForUpdate ?? [];

        if (!Array.isArray(allData) || allData.length === 0) {
            await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'info',
                title: 'Δεν υπάρχουν δεδομένα',
                text: 'Δεν βρέθηκαν εγγραφές προς ενημέρωση.',
                showConfirmButton: true,
                confirmButtonText: 'Κλείσιμο',
                customClass: {
                    confirmButton: 'class-info custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });
            return;
        }

        // Χωρισμός σε chunks
        const CHUNK_SIZE = 1000;
        const PARALLEL = 4;
        const totalRecords = allData.length;
        const chunks = [];
        for (let i = 0; i < allData.length; i += CHUNK_SIZE) {
            chunks.push(allData.slice(i, i + CHUNK_SIZE));
        }

        // ✅ Άνοιγμα loader ΜΙΑ ΦΟΡΑ — δεν ξανανοίγει, δεν κάνει flash
        openProgressSwal(totalRecords);

        try {
            let totalModified = 0;
            let totalUpserted = 0;
            let processedRecords = 0;

            for (let i = 0; i < chunks.length; i += PARALLEL) {
                const batch = chunks.slice(i, i + PARALLEL);

                // Ενημέρωση label πριν ξεκινήσει το batch
                updateProgress(
                    processedRecords,
                    totalRecords,
                    `Αποστολή εγγραφών ${(processedRecords + 1).toLocaleString('el-GR')} – ${Math.min(processedRecords + batch.reduce((s, c) => s + c.length, 0), totalRecords).toLocaleString('el-GR')}...`
                );

                // ✅ Παράλληλη αποστολή
                const results = await Promise.all(batch.map((chunk) => sendChunk(chunk)));

                results.forEach((data, idx) => {
                    processedRecords += batch[idx].length;
                    totalModified += data?.stats?.modified ?? 0;
                    totalUpserted += data?.stats?.upserted ?? 0;
                });

                // ✅ Ενημέρωση progress bar μετά το batch
                updateProgress(
                    processedRecords,
                    totalRecords,
                    processedRecords >= totalRecords
                        ? 'Ολοκλήρωση...'
                        : `Αποθηκεύτηκαν ${processedRecords.toLocaleString('el-GR')} από ${totalRecords.toLocaleString('el-GR')} εγγραφές...`
                );
            }

            // ✅ Επιτυχία — αντικαθιστά τον loader χωρίς flash
            await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'success',
                title: 'Επιτυχής ενημέρωση!',
                html: `
                    Σύνολο εγγραφών: <b>${totalRecords.toLocaleString('el-GR')}</b><br>
                    Ενημερώθηκαν: <b>${totalModified.toLocaleString('el-GR')}</b><br>
                    Νέες εγγραφές: <b>${totalUpserted.toLocaleString('el-GR')}</b>
                `,
                showConfirmButton: true,
                confirmButtonText: 'Κλείσιμο',
                customClass: {
                    confirmButton: 'class-success custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            }).then(() => {
                window.location.href = '/symbaseis/ypologismoiKlimakion';
            });
        } catch (err) {
            await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'error',
                title: 'Αποτυχία ενημέρωσης κλιμακίων',
                text: String(err?.message || err),
                showConfirmButton: true,
                confirmButtonText: 'Κλείσιμο',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });
        }
    }

    editBtn.addEventListener('click', handleEditClick);
});
