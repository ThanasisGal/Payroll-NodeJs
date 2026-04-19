// ypologismos.js
if (typeof Decimal !== 'undefined') {
    Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
}

window.dataForUpdate = [];
window.treeData = {};
window.categoryDescriptions = {};
window.eidikotitaDescriptions = {};
window.maxKlimaKiaFrom0001 = 0;

// ------------------------------
// ΒΟΗΘΗΤΙΚΑ ΓΙΑ ΔΟΜΕΣ ΔΕΔΟΜΕΝΩΝ
// ------------------------------
function collectRow({ uniqueCode, item, result, isxyeiApo, isxyeiEos, praxhKatatheshs }) {
    window.dataForUpdate.push({
        kodikos_symbashs: uniqueCode.substring(0, 4),
        kodikos_kathgorias_symbashs: uniqueCode.substring(4, 8),
        kodikos_eidikothtas_symbashs: uniqueCode.substring(8, 12),
        kodikos_stoixeioy: uniqueCode.substring(12, 16),
        klimakio: uniqueCode.substring(16),
        poso: result,
        isxyei_apo: isxyeiApo,
        isxyei_eos: isxyeiEos,
        praxh_katatheshs: praxhKatatheshs,
        afora_thn_symbash: uniqueCode.substring(0, 4),
        afora_thn_symbash_kathgoria: uniqueCode.substring(0, 8),
        afora_thn_symbash_kathgoria_eidikothta: uniqueCode.substring(0, 12),
        afora_thn_symbash_kathgoria_eidikothta_stoixeio: uniqueCode.substring(0, 16)
    });

    const katigoria = uniqueCode.substring(0, 8);
    const eidikotita = uniqueCode.substring(0, 12);
    const kodStoixeiou = uniqueCode.substring(0, 16);
    const klimakio = uniqueCode.substring(16);

    const perigrafhStoixeioy = item.perigrafh_stoixeioy ?? item.perigrafh ?? '';
    const katastash =
        item.typos_ypologismoy && String(item.typos_ypologismoy).trim() !== '' ? '✔️' : '❌';

    if (!window.treeData[katigoria]) window.treeData[katigoria] = {};
    if (!window.treeData[katigoria][eidikotita]) window.treeData[katigoria][eidikotita] = {};
    if (!window.treeData[katigoria][eidikotita][kodStoixeiou]) {
        window.treeData[katigoria][eidikotita][kodStoixeiou] = { perigrafhStoixeioy, periods: {} };
    }

    const stoixeioNode = window.treeData[katigoria][eidikotita][kodStoixeiou];
    const periodKey = `${isxyeiApo}__${isxyeiEos}`;
    if (!stoixeioNode.periods[periodKey]) {
        stoixeioNode.periods[periodKey] = { isxyeiApo, isxyeiEos, klimakia: [] };
    }
    stoixeioNode.periods[periodKey].klimakia.push({ klimakio, poso: result, katastash });
}

// ------------------------------
// ΒΟΗΘΗΤΙΚΟ: Ενημέρωση Swal Progress
// ------------------------------
function updateSwalProgress(step, total, label) {
    const pct = total > 0 ? Math.round((step / total) * 100) : 0;
    const bar = document.getElementById('ypol-progress-bar');
    const lbl = document.getElementById('ypol-progress-label');
    if (bar) {
        bar.style.width = `${pct}%`;
        bar.textContent = `${pct}%`;
        bar.setAttribute('aria-valuenow', pct);
    }
    if (lbl && label) lbl.textContent = label;
}

function openProgressSwal() {
    Swal.fire({
        backdrop: false,
        allowOutsideClick: false,
        title: 'Υπολογισμός κλιμακίων...',
        html: `
            <div id="ypol-progress-label" class="mb-2 fsvw-1_0">Αρχικοποίηση...</div>
            <div class="progress" style="height:22px; border-radius:8px;">
                <div id="ypol-progress-bar"
                     class="progress-bar progress-bar-striped progress-bar-animated bg-success"
                     role="progressbar"
                     style="width:0%;"
                     aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                    0%
                </div>
            </div>
        `,
        showConfirmButton: false,
        // willOpen: () => Swal.showLoading()
        didOpen: () => Swal.hideLoading() // ✅ Εξαναγκάζει απόκρυψη loader
    });
}

// ------------------------------
// RENDER NESTED COLLAPSIBLE UI
// ------------------------------
function createGroupRow(tbody, label, id, level = 'generic') {
    const tr = document.createElement('tr');
    tr.classList.add('group-row');

    if (level === 'category') {
        tr.classList.add('group-row--category');
        tr.innerHTML = `
            <td colspan="7" class="fw-bold">
                <span class="chevron">▸</span> ${label}
            </td>`;
    } else if (level === 'eidikotita') {
        tr.classList.add('group-row--eidikotita');
        tr.innerHTML = `
            <td colspan="7" class="fw-bold p-0">
                <div class="row g-0 align-items-stretch eidikotita-row-wrapper">
                    <div class="col-1"></div>
                    <div class="col-11 eidikotita-cell">
                        <span class="chevron">▸</span> ${label}
                    </div>
                </div>
            </td>`;
    } else if (level === 'stoixeio') {
        tr.classList.add('group-row--stoixeio');
        tr.innerHTML = `
            <td colspan="7" class="fw-bold p-0">
                <div class="row g-0 align-items-stretch stoixeio-row-wrapper">
                    <div class="col-2"></div>
                    <div class="col-10 stoixeio-cell">
                        <span class="chevron">▸</span> ${label}
                    </div>
                </div>
            </td>`;
    } else {
        tr.innerHTML = `
            <td colspan="7" class="fw-bold">
                <span class="chevron">▸</span> ${label}
            </td>`;
    }

    tr.dataset.target = id;
    tbody.appendChild(tr);
}

function createChildContainerRow(tbody, id) {
    const tr = document.createElement('tr');
    tr.classList.add('collapse-row');
    tr.dataset.rowId = id;
    tr.style.display = 'none';
    tr.innerHTML = `
        <td colspan="7">
            <table class="table table-sm mb-0"><tbody></tbody></table>
        </td>`;
    tbody.appendChild(tr);
    return tr.querySelector('tbody');
}

function renderNestedTables(tbody) {
    // ✅ Χτίζουμε σε DocumentFragment → ένα μόνο DOM write, μηδέν flash
    const fragment = document.createDocumentFragment();
    const tempTbody = document.createElement('tbody');

    const tree = window.treeData || {};
    const katKeys = Object.keys(tree).sort();

    for (const katigoria of katKeys) {
        const katId = `kat-${katigoria}`;
        const katDescr = (window.categoryDescriptions || {})[katigoria] || '';
        const katLabel = katDescr
            ? `Κατηγορία ${katigoria.substring(4, 8)} <span class="font-size-vw-0_72 font-weight-500 ms-2">${katDescr}</span>`
            : `Κατηγορία ${katigoria.substring(4, 8)}`;

        createGroupRow(tempTbody, katLabel, katId, 'category');
        const katBody = createChildContainerRow(tempTbody, katId);

        for (const eidikotita of Object.keys(tree[katigoria]).sort()) {
            const eidId = `eid-${katigoria}-${eidikotita}`;
            const eidDescr = (window.eidikotitaDescriptions || {})[eidikotita] || '';
            const eidLabel = eidDescr
                ? `Ειδικότητα ${eidikotita.substring(8, 12)} <span class="font-size-vw-0_72 font-weight-500 ms-2">${eidDescr}</span>`
                : `Ειδικότητα ${eidikotita.substring(8, 12)}`;

            createGroupRow(katBody, eidLabel, eidId, 'eidikotita');
            const eidBody = createChildContainerRow(katBody, eidId);

            for (const kodStoixeiou of Object.keys(tree[katigoria][eidikotita]).sort()) {
                const stoixNode = tree[katigoria][eidikotita][kodStoixeiou];
                const stoixId = `stoix-${katigoria}-${eidikotita}-${kodStoixeiou}`;
                const stoixDescr = stoixNode.perigrafhStoixeioy || '';
                const stoixLabel = stoixDescr
                    ? `Στοιχείο ${kodStoixeiou.substring(12, 16)} <span class="font-size-vw-0_72 font-weight-500 ms-2">${stoixDescr}</span>`
                    : `Στοιχείο ${kodStoixeiou.substring(12, 16)}`;

                createGroupRow(eidBody, stoixLabel, stoixId, 'stoixeio');
                const stoixBody = createChildContainerRow(eidBody, stoixId);
                const periodKeys = Object.keys(stoixNode.periods || {}).sort();

                if (periodKeys.length > 0) {
                    const headerRow = document.createElement('tr');
                    headerRow.innerHTML = `
                        <th colspan="7" class="fw-normal p-0">
                            <div class="row g-0 align-items-stretch">
                                <div class="col-3"></div>
                                <div class="col-2 text-center font-weight-700">α/α Κλιμακίου</div>
                                <div class="col-2 text-end font-weight-700">Ποσό</div>
                                <div class="col-2 text-center font-weight-700">Κατάσταση</div>
                                <div class="col-3"></div>
                            </div>
                        </th>`;
                    stoixBody.appendChild(headerRow);

                    for (const periodKey of periodKeys) {
                        const klimakia = (stoixNode.periods[periodKey].klimakia || []).sort(
                            (a, b) => Number(a.klimakio) - Number(b.klimakio)
                        );

                        for (const k of klimakia) {
                            const tr = document.createElement('tr');
                            tr.classList.add('klimakio-row-ypologismon');
                            const posoDisp =
                                typeof k.poso === 'number' && Number.isFinite(k.poso)
                                    ? k.poso.toLocaleString('el-GR', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                      })
                                    : '';
                            tr.innerHTML = `
                                <td colspan="7" class="p-0">
                                    <div class="row g-0 align-items-stretch">
                                        <div class="col-3"></div>
                                        <div class="klimakio-content-ypologismon">
                                            <div class="col-2 klimakio-cell-ypologismon text-center padding-top-rem-0_4">${k.klimakio}</div>
                                            <div class="col-2 klimakio-cell-ypologismon text-end padding-top-rem-0_4">${posoDisp}</div>
                                            <div class="col-2 klimakio-cell-ypologismon text-center padding-top-rem-0_4">${k.katastash || ''}</div>
                                        </div>
                                        <div class="col-3"></div>
                                    </div>
                                </td>`;
                            stoixBody.appendChild(tr);
                        }
                    }
                }
            }
        }
    }

    // ✅ Ένα μόνο DOM write — μηδέν flash
    while (tempTbody.firstChild) fragment.appendChild(tempTbody.firstChild);
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

// Collapsible toggle
document.addEventListener('click', function (e) {
    const row = e.target.closest('tr.group-row');
    if (!row) return;
    const targetId = row.dataset.target;
    if (!targetId) return;
    const contentRow = document.querySelector(`tr[data-row-id="${targetId}"]`);
    if (!contentRow) return;
    const isHidden = contentRow.style.display === 'none';
    contentRow.style.display = isHidden ? '' : 'none';
    const chevron = row.querySelector('.chevron');
    if (chevron) chevron.textContent = isHidden ? '▾' : '▸';
});

// ------------------------------
// MAIN: Υπολογισμός κλιμακίων
// ------------------------------
document.addEventListener('DOMContentLoaded', function () {
    const addBtn = document.getElementById('add-btn');
    if (!addBtn) return;

    addBtn.addEventListener('click', async () => {
        const tbody = document.querySelector('#myTable tbody');
        if (!tbody) return;

        // Reset
        window.dataForUpdate = [];
        window.treeData = {};
        window.categoryDescriptions = {};
        window.eidikotitaDescriptions = {};
        window.maxKlimaKiaFrom0001 = 0;

        const isxyeiApo = document.getElementById('isxyei_apo').value;
        const isxyeiEos = document.getElementById('isxyei_eos').value;
        const praxhKatatheshs = document.getElementById('praxh_katatheshs').value;

        if (!isxyeiApo || !isxyeiEos) {
            Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'info',
                title: 'Δεν έχει οριστεί περίοδος ισχύος',
                html: 'Παρακαλώ ορίστε τις ημερομηνίες <strong>Από Ημ/νία Έναρξης</strong> και <strong>Έως Ημ/νία Λήξης</strong>',
                showConfirmButton: true,
                confirmButtonText: 'Κλείσιμο',
                customClass: {
                    confirmButton: 'class-info custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            }).then(() => {
                try {
                    symSelect?.focus();
                } catch (_) {}
            });
            return;
        }

        // ✅ Άνοιγμα loader ΜΟΝΟ ΜΙΑ ΦΟΡΑ — δεν ξανανοίγει, δεν κάνει flash
        openProgressSwal();

        try {
            const el = document.getElementById('eidikothta_symbashs_table');
            const raw = (el.value ?? el.textContent ?? '').trim();
            const eidArr = JSON.parse(raw || '[]');

            const symbashSet = new Set(
                eidArr.map((r) => r.afora_thn_symbash_kathgoria?.slice(0, 4)).filter(Boolean)
            );
            const symbashKathgoriaSet = new Set(
                eidArr.map((r) => r.afora_thn_symbash_kathgoria).filter(Boolean)
            );

            // ✅ ΠΑΡΑΛΛΗΛΑ fetches για κατηγορίες
            updateSwalProgress(0, 4, 'Φόρτωση κατηγοριών...');
            await Promise.all(
                [...symbashSet].map(async (symbash) => {
                    try {
                        const resp = await fetch(
                            `/api/kathgoriesSymbaseon/${encodeURIComponent(symbash)}`,
                            {
                                method: 'GET',
                                credentials: 'same-origin',
                                skipLoader: true, // ✅ παρακάμπτει τον global AppLoader
                                headers: { Accept: 'application/json' }
                            }
                        );
                        if (!resp.ok) throw new Error('HTTP ' + resp.status);
                        for (const kat of await resp.json()) {
                            const katCode = symbash + kat.kodikos;
                            const katDescr =
                                kat.perigrafi_kathgorias ??
                                kat.perigrafh_kathgorias ??
                                kat.perigrafh ??
                                '';
                            if (katCode && katDescr && !window.categoryDescriptions[katCode])
                                window.categoryDescriptions[katCode] = katDescr;
                        }
                    } catch (err) {
                        console.error('kathgoriesSymbaseon', symbash, err);
                    }
                })
            );

            // ✅ ΠΑΡΑΛΛΗΛΑ fetches για ειδικότητες
            updateSwalProgress(1, 4, 'Φόρτωση ειδικοτήτων...');
            await Promise.all(
                [...symbashKathgoriaSet].map(async (symKat) => {
                    try {
                        const resp = await fetch(
                            `/api/eidikothtesSymbaseon/${encodeURIComponent(symKat)}`,
                            {
                                method: 'GET',
                                credentials: 'same-origin',
                                skipLoader: true, // ✅ παρακάμπτει τον global AppLoader
                                headers: { Accept: 'application/json' }
                            }
                        );
                        if (!resp.ok) throw new Error('HTTP ' + resp.status);
                        for (const eid of await resp.json()) {
                            const eidCode = symKat + eid.kodikos;
                            const eidDescr =
                                eid.perigrafi_eidikothtas ??
                                eid.perigrafh_eidikothtas ??
                                eid.perigrafh ??
                                '';
                            if (eidCode && eidDescr && !window.eidikotitaDescriptions[eidCode])
                                window.eidikotitaDescriptions[eidCode] = eidDescr;
                        }
                    } catch (err) {
                        console.error('eidikothtesSymbaseon', symKat, err);
                    }
                })
            );

            // ✅ ΠΑΡΑΛΛΗΛΑ fetches για στοιχεία (4 ταυτόχρονα)
            updateSwalProgress(2, 4, 'Φόρτωση στοιχείων συμβάσεων...');
            const fetchList = eidArr
                .filter((row) => row.kodikos)
                .map((row) => ({
                    row,
                    key: `${(row.afora_thn_symbash_kathgoria ?? '').slice(0, 4)}${(row.afora_thn_symbash_kathgoria ?? '').slice(4, 8)}${row.kodikos}`
                }));

            const PARALLEL = 4;
            const allFetched = [];
            for (let i = 0; i < fetchList.length; i += PARALLEL) {
                const batch = fetchList.slice(i, i + PARALLEL);
                const results = await Promise.all(
                    batch.map(async ({ row, key }) => {
                        try {
                            const response = await fetch(
                                `/api/stoixeiaSymbaseon/${encodeURIComponent(key)}`,
                                {
                                    method: 'GET',
                                    credentials: 'same-origin',
                                    skipLoader: true, // ✅ παρακάμπτει τον global AppLoader
                                    headers: { Accept: 'application/json' }
                                }
                            );
                            if (!response.ok) throw new Error('HTTP ' + response.status);
                            return { row, data: await response.json() };
                        } catch (err) {
                            console.error('stoixeiaSymbaseon', key, err);
                            return null;
                        }
                    })
                );
                allFetched.push(...results.filter(Boolean));

                // ✅ Ενημέρωση progress χωρίς setTimeout flash
                updateSwalProgress(
                    2 + i / fetchList.length,
                    4,
                    `Φόρτωση στοιχείων ${Math.min(i + PARALLEL, fetchList.length)} / ${fetchList.length}...`
                );
            }

            // Max κλιμάκιο από '0001'
            window.maxKlimaKiaFrom0001 = 0;
            for (const { data } of allFetched) {
                for (const it of data || []) {
                    if (it && String(it.kodikos) === '0001') {
                        const ak = Number(it.arithmos_klimakion) || 0;
                        if (ak > window.maxKlimaKiaFrom0001) window.maxKlimaKiaFrom0001 = ak;
                    }
                }
            }

            // ✅ Υπολογισμοί — χωρίς setTimeout, με progress update
            updateSwalProgress(3, 4, 'Υπολογισμός κλιμακίων...');
            const totalItems = allFetched.reduce((s, { data }) => s + (data?.length || 0), 0);
            let doneItems = 0;

            for (const { data } of allFetched) {
                if (!data?.length) continue;

                for (const item of data) {
                    if (!item) continue;

                    const arithmosKlimakion = Number(item.arithmos_klimakion) || 0;
                    const vhmaYpologismou = Number(item.vhma_ypologismou) || 1;
                    let lastResult = 0;

                    for (let i = 1; i <= arithmosKlimakion; i += vhmaYpologismou) {
                        const klimakioDisp = String(i).padStart(2, '0');
                        const uniqueCode = `${item.afora_thn_symbash_kathgoria_eidikothta}${item.kodikos}${klimakioDisp}`;
                        const multiplier =
                            item.ypologismos_apo_klimakio > 1
                                ? Math.floor((i - 1) / item.ypologismos_apo_klimakio)
                                : 1;

                        const result = dynamicCalculation(
                            data,
                            item,
                            item.typos_ypologismoy ?? '',
                            multiplier,
                            i
                        );
                        lastResult = result;
                        collectRow({
                            uniqueCode,
                            item,
                            result,
                            isxyeiApo,
                            isxyeiEos,
                            praxhKatatheshs
                        });
                    }

                    // Συμπλήρωση κλιμακίων
                    if (
                        window.maxKlimaKiaFrom0001 > 0 &&
                        arithmosKlimakion < window.maxKlimaKiaFrom0001
                    ) {
                        for (
                            let i = Math.max(arithmosKlimakion + vhmaYpologismou, 1);
                            i <= window.maxKlimaKiaFrom0001;
                            i += vhmaYpologismou
                        ) {
                            const klimakioDisp = String(i).padStart(2, '0');
                            const uniqueCode = `${item.afora_thn_symbash_kathgoria_eidikothta}${item.kodikos}${klimakioDisp}`;
                            collectRow({
                                uniqueCode,
                                item,
                                result: lastResult,
                                isxyeiApo,
                                isxyeiEos,
                                praxhKatatheshs
                            });
                        }
                    }

                    doneItems++;
                    updateSwalProgress(
                        3 + doneItems / totalItems,
                        4,
                        `Υπολογισμός ${doneItems} / ${totalItems} στοιχείων...`
                    );
                }
            }

            // ✅ Render σε DocumentFragment — ΕΝΑ DOM write, μηδέν flash
            updateSwalProgress(4, 4, 'Εμφάνιση αποτελεσμάτων...');
            renderNestedTables(tbody);

            // ✅ Κλείσιμο loader χωρίς flash
            Swal.close();
        } catch (error) {
            console.error(error);
            Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'error',
                title: 'Σφάλμα υπολογισμού',
                text: String(error?.message || error),
                showConfirmButton: true,
                confirmButtonText: 'Κλείσιμο',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });
        }
    });
});

// ------------------------------
// dynamicCalculation
// ------------------------------
function dynamicCalculation(data, item, expression, multiplier, klimakio) {
    const startKlimakio = Number(item?.ypologismos_apo_klimakio) || 0;
    const bhmaYpologismou = Number(item?.vhma_ypologismou ?? item?.bhma_ypologismou) || 1;

    let expr = String(expression || '');

    expr = expr.replace(/poso\((\d{4})\)/gi, (_, code) => {
        const row = (window.dataForUpdate || []).find(
            (r) => r.kodikos_stoixeioy === code && Number(r.klimakio) === Number(klimakio)
        );
        if (row?.poso != null && !isNaN(row.poso)) return String(row.poso);
        const ci = data.find(({ kodikos }) => kodikos === code);
        if (!ci) return '0';
        return String(
            Number(String(ci.poso ?? '0').replace(',', '.')) ||
                Number(String(ci.pososto ?? '0').replace(',', '.'))
        );
    });

    expr = expr.replace(/\b(\d{4})\b/g, (_, code) => {
        const ci = data.find(({ kodikos }) => kodikos === code);
        if (!ci) return '0';
        const poso = Number(String(ci.poso ?? '0').replace(',', '.')) || 0;
        const pososto = Number(String(ci.pososto ?? '0').replace(',', '.')) || 0;
        return String(
            ci.poso_pososto === 1
                ? poso || pososto
                : ci.poso_pososto === 0
                  ? pososto || poso
                  : poso || pososto
        );
    });

    expr = expr
        .replace(/multiplier/gi, String(multiplier ?? 0))
        .replace(/\bklimakio\b/gi, String(klimakio ?? 0))
        .replace(/ypologismos_apo_klimakio/gi, String(startKlimakio))
        .replace(/bhma_ypologismou|bhma_ypologismoy/gi, String(bhmaYpologismou));

    try {
        const result = math.evaluate(expr);
        if (typeof Decimal !== 'undefined') {
            const d = new Decimal(result.toString());
            if (!d.isFinite()) return 0;
            return Number(d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
        }
        if (!Number.isFinite(result)) return 0;
        return Number(result.toFixed(2));
    } catch (err) {
        console.error('dynamicCalculation error:', err, expr);
        return 0;
    }
}
