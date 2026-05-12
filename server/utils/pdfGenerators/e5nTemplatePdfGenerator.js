// ============================================================================
// E5N TEMPLATE PDF GENERATOR
// Γεμίζει το official template PDF του ΕΡΓΑΝΗ
// Coordinates σε mm + wrap + bold support
// ============================================================================

const { SepeModel } = require('../../models/stathera_arxeia');
const { DypaModel } = require('../../models/stathera_arxeia');
const { NomikesMorfesModel } = require('../../models/stathera_arxeia');
const { DoyModel } = require('../../models/stathera_arxeia');

const fs = require('fs-extra');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

const { uploadBufferToS3 } = require('../s3Helper');

const PT_PER_MM = 72 / 25.4;

function mm(value) {
    return Number(value) * PT_PER_MM;
}

function fromTopMm(page, valueMm) {
    return page.getHeight() - mm(valueMm);
}

function sm(value) {
    return Number(value);
}

function posMm(page, xMm, yFromTopMm, size = 6) {
    return {
        x: mm(xMm),
        y: fromTopMm(page, yFromTopMm),
        size: sm(size)
    };
}

function formatDate(date) {
    if (!date) return '';

    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [y, m, d] = date.split('-');
        return `${d}/${m}/${y}`;
    }

    const dt = new Date(date);
    if (isNaN(dt.getTime())) return '';

    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined || amount === '') return '0,00';

    const numeric = Number(String(amount).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(numeric)) return '0,00';

    return numeric.toFixed(2).replace('.', ',');
}

function getKad4(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits ? digits.slice(0, 4).padEnd(4, '0') : '';
}

function boolLabel(value) {
    return value ? 'NAI' : 'OXI';
}

function cleanFilePart(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^\p{L}\p{N}_-]/gu, '')
        .toUpperCase();
}

function wrapText(text, font, size, maxWidth) {
    const words = String(text || '')
        .trim()
        .split(/\s+/);
    const lines = [];
    let line = '';

    for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, size);

        if (testWidth <= maxWidth) {
            line = testLine;
        } else {
            if (line) lines.push(line);
            line = word;
        }
    }

    if (line) lines.push(line);

    return lines;
}

async function generateE5NPdf(ergazomenos, companyData, ypokatasthmataData, options = {}) {
    try {
        const apoxwrisiDate =
            options.hmeromhnia_apoxwrhshs ||
            options.apoxwrisi_date ||
            ergazomenos.hmeromhnia_apoxwrhshs ||
            ergazomenos.hmeromhnia_apoxorhshs ||
            ergazomenos.hmeromhnia_apoxorisis ||
            ergazomenos.apoxwrisi_date ||
            ergazomenos.apoxwrisidate ||
            '';

        const templatePath = path.join(
            process.cwd(),
            'server',
            'templates',
            'pdf',
            'e5n_template.pdf'
        );

        if (!(await fs.pathExists(templatePath))) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        const existingPdfBytes = await fs.readFile(templatePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        pdfDoc.registerFontkit(fontkit);

        const pages = pdfDoc.getPages();
        const page1 = pages[0];
        const page2 = pages[1];

        if (!page1 || !page2) {
            throw new Error('Το e5n_template.pdf πρέπει να έχει τουλάχιστον 2 σελίδες.');
        }

        const greekFontPath = path.join(process.cwd(), 'fonts', 'DejaVuSans', 'DejaVuSans.ttf');
        const greekBoldFontPath = path.join(
            process.cwd(),
            'fonts',
            'DejaVuSans',
            'DejaVuSans-Bold.ttf'
        );

        if (!(await fs.pathExists(greekFontPath))) {
            throw new Error(`Δεν βρέθηκε το DejaVuSans.ttf στο path: ${greekFontPath}`);
        }

        if (!(await fs.pathExists(greekBoldFontPath))) {
            throw new Error(`Δεν βρέθηκε το DejaVuSans-Bold.ttf στο path: ${greekBoldFontPath}`);
        }

        const font = await pdfDoc.embedFont(await fs.readFile(greekFontPath));
        const boldFont = await pdfDoc.embedFont(await fs.readFile(greekBoldFontPath));

        const drawText = (page, text, pos) => {
            const cleanText = String(text ?? '').trim();
            if (!cleanText) return;

            const activeFont = pos.bold ? boldFont : font;
            const lines = cleanText.split('\n');
            const lineHeight = pos.lineHeight || pos.size + 3;

            lines.forEach((line, index) => {
                page.drawText(line, {
                    x: pos.x,
                    y: pos.y - index * lineHeight,
                    size: pos.size,
                    font: activeFont,
                    color: rgb(0, 0, 0)
                });
            });
        };

        const drawWrappedText = (page, text, pos) => {
            const cleanText = String(text ?? '').trim();
            if (!cleanText) return;

            const activeFont = pos.bold ? boldFont : font;
            const maxWidth = pos.maxWidth || mm(50);
            const maxLines = pos.maxLines || 2;
            const lineHeight = pos.lineHeight || pos.size + 2;

            const lines = wrapText(cleanText, activeFont, pos.size, maxWidth).slice(0, maxLines);

            lines.forEach((line, index) => {
                page.drawText(line, {
                    x: pos.x,
                    y: pos.y - index * lineHeight,
                    size: pos.size,
                    font: activeFont,
                    color: rgb(0, 0, 0)
                });
            });
        };

        const drawField = (page, text, pos) => {
            if (pos.wrap) {
                drawWrappedText(page, text, pos);
            } else {
                drawText(page, text, pos);
            }
        };

        const sepeKodikos = String(ypokatasthmataData?.sepe_ergoy || '').trim();
        const dypaKodikos = String(ypokatasthmataData?.dypa_ergoy || '').trim();
        const nomMorfhKodikos = String(companyData?.nomikh_morfh || '').trim();
        const doyKodikos = String(companyData?.doy_company || companyData?.doy || '').trim();

        const [sepeRecord, dypaRecord, nomMorfhRecord, doyRecord] = await Promise.all([
            sepeKodikos ? SepeModel.findOne({ kodikos: sepeKodikos }).lean() : null,
            dypaKodikos ? DypaModel.findOne({ kodikos: dypaKodikos }).lean() : null,
            nomMorfhKodikos
                ? NomikesMorfesModel.findOne({ kodikos: nomMorfhKodikos }).lean()
                : null,
            doyKodikos ? DoyModel.findOne({ kodikos: doyKodikos }).lean() : null
        ]);

        const sepePerigrafh = sepeRecord?.perigrafh || sepeKodikos || '';
        const dypaPerigrafh = dypaRecord?.perigrafh || dypaKodikos || '';
        const nomMorfhPerigrafh = nomMorfhRecord?.perigrafh || nomMorfhKodikos || '';
        const doyPerigrafh = doyRecord?.perigrafh || doyKodikos || '';

        const isFysikoProsopo = Boolean(String(companyData?.firstname || '').trim());
        const isEdra = String(ypokatasthmataData?.kodikos || '').trim() === '0000';

        const pdfData = {
            f_ypiresia_sepe: sepeKodikos,
            f_ypiresia_sepe_perigrafh: sepePerigrafh,
            f_ypiresia_oaed: dypaKodikos,
            f_ypiresia_oaed_perigrafh: dypaPerigrafh,
            f_nomikh_morfh_perigrafh: nomMorfhPerigrafh,
            f_doy_perigrafh: doyPerigrafh,
            f_aa_pararthmatos: String(ypokatasthmataData?.kodikos || '').trim(),
            f_kad_pararthmatos:
                getKad4(
                    ypokatasthmataData?.kad6 ||
                        ypokatasthmataData?.kad ||
                        companyData?.kad6 ||
                        companyData?.kad
                ) || '0000',

            employer_name: companyData?.eponymia || '',
            employer_firstname: companyData?.firstname || '',
            employer_fathername: companyData?.fathername || '',
            employer_afm: companyData?.afm || '',
            employer_ame: companyData?.ame1 || '',
            employer_fysiko_prosopo: isFysikoProsopo ? ' ☑\n☐' : ' ☐\n☑',
            employer_doy: companyData?.doy_company || '',
            employer_nomikh_morfh: companyData?.nomikh_morfh || '',
            employer_title: companyData?.titlos || '',
            employer_activity: companyData?.activity || '',
            employer_edra: isEdra ? ' ☑\n☐' : ' ☐\n☑',

            employer_email: companyData?.email || ypokatasthmataData?.email || '',
            employer_phone:
                ypokatasthmataData?.thlefono ||
                ypokatasthmataData?.thlefwno ||
                companyData?.thlefono ||
                '',
            employer_address:
                ypokatasthmataData?.dieythynsh ||
                ypokatasthmataData?.odos ||
                companyData?.dieythynsh ||
                companyData?.odos ||
                '',
            employer_tk: ypokatasthmataData?.tk || companyData?.tk || '',
            employer_dimos: ypokatasthmataData?.dhmos || ypokatasthmataData?.polh || '',
            employer_koinothta: ypokatasthmataData?.koinothta || '',
            employer_efka_branch:
                ypokatasthmataData?.ypokatastima_efka || ypokatasthmataData?.ypokatastima_ika || '',
            employer_efka_code:
                ypokatasthmataData?.kodikos_ypok_efka ||
                ypokatasthmataData?.kodikos_ypokatastimatos_efka ||
                '',
            employer_present_status: ypokatasthmataData?.parousa_katastash || '',

            f_eponymo: ergazomenos.eponymo || '',
            f_onoma: ergazomenos.onoma || '',
            f_onoma_patros: ergazomenos.patronymo || '',
            f_onoma_mitros: ergazomenos.mhtronymo || '',
            f_birthdate: formatDate(ergazomenos.hmeromhnia_gennhshs),
            f_sex: ergazomenos.fylo ? 'ΓΥΝΑΙΚΑ' : 'ΑΝΔΡΑΣ',
            f_yphkoothta: ergazomenos.yphkoothta || '',
            f_typos_taytothtas: ergazomenos.typos_taytothtas || 'ΔΑΤ',
            f_ar_taytothtas: ergazomenos.adt || '',
            f_ekdousa_arxh: ergazomenos.arxh_ekdoshs || '',
            f_date_ekdosis: formatDate(ergazomenos.hmeromhnia_ekdoshs),
            f_date_ekdosis_lixi: formatDate(ergazomenos.hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy),
            f_marital_status: ergazomenos.oikogeneiakh_katastash || '',
            f_arithmos_teknon: String(ergazomenos.arithmos_teknon || 0),
            f_afm: ergazomenos.afm || '',
            f_doy: ergazomenos.doy || '',
            f_amika: ergazomenos.ama_krathshs_01 || ergazomenos.amika || '',
            f_amka: ergazomenos.amka || '',
            f_code_anergias: ergazomenos.arithmos_deltioy_anergias || '',
            f_ar_vivliou_anilikou: ergazomenos.arithmos_bibliarioy_anhlikoy || '',
            f_epipedo_morfosis: ergazomenos.ekpaideytiko_epipedo || '',

            f_res_permit_inst: boolLabel(ergazomenos.adeia_diamonhs_me_amesh_prosbash_gia_ergasia),
            f_res_permit_inst_type:
                ergazomenos.eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia || '',
            f_res_permit_inst_ar:
                ergazomenos.arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia || '',
            f_res_permit_inst_lixi: formatDate(
                ergazomenos.hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia
            ),

            f_res_permit_ap: boolLabel(ergazomenos.adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia),
            f_res_permit_ap_type:
                ergazomenos.eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia || '',
            f_res_permit_ap_ar:
                ergazomenos.arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia || '',
            f_res_permit_ap_lixi: formatDate(
                ergazomenos.hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia
            ),

            f_res_permit_visa: boolLabel(ergazomenos.adeia_eisodoy_gia_epoxikh_apasxolhsh),
            f_res_permit_visa_ar: ergazomenos.arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh || '',
            f_res_permit_visa_from: formatDate(
                ergazomenos.apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh
            ),
            f_res_permit_visa_to: formatDate(
                ergazomenos.eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh
            ),

            f_xaraktirismos: ergazomenos.xarakthrismos_ergazomenon ? 'ΕΡΓΑΤΗΣ' : 'ΥΠΑΛΛΗΛΟΣ',
            f_sxeshapasxolisis: ergazomenos.sxesh_ergasias || '',
            f_orismenou_apo:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDate(ergazomenos.hmeromhnia_proslhpshs)
                    : '',
            f_orismenou_ews:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDate(ergazomenos.hmeromhnia_lhxhs_symbashs)
                    : '',
            f_kathestosapasxolisis: ergazomenos.kathestos_apasxolhshs || '',
            f_eidikothta: ergazomenos.eidikothta_erganh || '',
            f_proslipsidate: formatDate(ergazomenos.hmeromhnia_proslhpshs),
            f_apoxwrisidate: formatDate(apoxwrisiDate),
            f_apodoxes: formatCurrency(
                ergazomenos.pragmatikosMisthos ||
                    ergazomenos.synolo_symbashs ||
                    ergazomenos.apodoxes_apoxwrhshs ||
                    0
            ),
            f_comments: ergazomenos.parathrhseis || options.comments || ''
        };

        const E5N_POSITIONS = {
            page1: {
                f_ypiresia_oaed_perigrafh: {
                    ...posMm(page1, 44, 30, 8),
                    wrap: true,
                    maxWidth: mm(40),
                    maxLines: 2,
                    lineHeight: 7
                },
                f_ypiresia_oaed: posMm(page1, 137, 30, 8),

                f_ypiresia_sepe_perigrafh: {
                    ...posMm(page1, 44, 42, 8),
                    wrap: true,
                    maxWidth: mm(40),
                    maxLines: 2,
                    lineHeight: 7
                },
                f_ypiresia_sepe: posMm(page1, 137, 42, 8),

                employer_name: {
                    ...posMm(page1, 44, 99.6, 7),
                    wrap: true,
                    maxWidth: mm(33),
                    maxLines: 3,
                    lineHeight: 7
                },
                employer_firstname: posMm(page1, 94, 100, 8),
                employer_fathername: posMm(page1, 159, 100, 8),

                employer_afm: posMm(page1, 44, 112, 8),
                employer_ame: posMm(page1, 94, 112, 8),
                employer_fysiko_prosopo: {
                    ...posMm(page1, 167, 108.5, 8),
                    lineHeight: 18,
                    bold: true
                },
                f_nomikh_morfh_perigrafh: {
                    ...posMm(page1, 44, 119.6, 7),
                    wrap: true,
                    maxWidth: mm(45),
                    maxLines: 2,
                    lineHeight: 7
                },
                f_doy_perigrafh: {
                    ...posMm(page1, 137, 119.6, 7),
                    wrap: true,
                    maxWidth: mm(60),
                    maxLines: 2,
                    lineHeight: 7
                },
                employer_title: posMm(page1, 44, 128, 8),
                employer_activity: {
                    ...posMm(page1, 135, 5, 128, 8),
                    wrap: true,
                    maxWidth: mm(60),
                    maxLines: 2,
                    lineHeight: 7
                },

                employer_edra: {
                    ...posMm(page1, 53, 139.6, 8),
                    lineHeight: 18,
                    bold: true
                },

                f_aa_pararthmatos: posMm(page1, 122.6, 143, 8),
                f_kad_pararthmatos: posMm(page1, 158.5, 141.5, 7),
                employer_efka_branch: posMm(page1, 19.4, 161.3, 6),
                employer_efka_code: posMm(page1, 109.4, 161.3, 6),
                employer_present_status: posMm(page1, 160.5, 161.3, 6),
                employer_address: posMm(page1, 19.4, 170.1, 6),
                employer_tk: posMm(page1, 19.4, 178.9, 6),
                employer_dimos: posMm(page1, 65.3, 178.9, 6),
                employer_koinothta: posMm(page1, 125.2, 178.9, 6),
                employer_phone: posMm(page1, 21.2, 187.8, 6),
                employer_email: posMm(page1, 90.0, 187.8, 6),

                f_eponymo: {
                    ...posMm(page1, 21.2, 204.0, 6),
                    wrap: true,
                    maxWidth: mm(58),
                    maxLines: 2,
                    lineHeight: 7
                },

                f_onoma: {
                    ...posMm(page1, 90.0, 204.0, 6),
                    bold: true
                },

                f_onoma_patros: posMm(page1, 21.2, 212.1, 6),
                f_onoma_mitros: posMm(page1, 90.0, 212.1, 6),
                f_afm: posMm(page1, 21.2, 220.9, 6),
                f_amka: posMm(page1, 74.1, 220.9, 6),
                f_amika: posMm(page1, 134.1, 220.9, 6),
                f_birthdate: posMm(page1, 24.7, 230.1, 6),
                f_sex: posMm(page1, 127.0, 230.1, 6),
                f_doy: posMm(page1, 19.4, 239.6, 6),
                f_code_anergias: posMm(page1, 134.1, 239.6, 6),
                f_marital_status: posMm(page1, 22.9, 250.5, 6),
                f_arithmos_teknon: posMm(page1, 109.4, 250.5, 6),
                f_yphkoothta: posMm(page1, 22.9, 260.7, 6),
                f_epipedo_morfosis: posMm(page1, 98.8, 260.7, 6),
                f_typos_taytothtas: posMm(page1, 20.5, 272.3, 6),
                f_ar_taytothtas: posMm(page1, 65.3, 272.3, 6),
                f_ekdousa_arxh: posMm(page1, 128.8, 272.3, 6),
                f_date_ekdosis: posMm(page1, 22.9, 281.5, 6),
                f_date_ekdosis_lixi: posMm(page1, 91.8, 281.5, 6),
                f_ar_vivliou_anilikou: posMm(page1, 67.0, 290.7, 6)
            },

            page2: {
                f_res_permit_inst: posMm(page2, 132.3, 37.4, 6),
                f_res_permit_inst_type: posMm(page2, 151.7, 43.4, 6),
                f_res_permit_inst_ar: posMm(page2, 151.7, 49.4, 6),
                f_res_permit_inst_lixi: posMm(page2, 151.7, 55.7, 6),

                f_res_permit_ap: posMm(page2, 132.3, 78.3, 6),
                f_res_permit_ap_type: posMm(page2, 151.7, 84.3, 6),
                f_res_permit_ap_ar: posMm(page2, 151.7, 90.3, 6),
                f_res_permit_ap_lixi: posMm(page2, 151.7, 96.7, 6),

                f_res_permit_visa: posMm(page2, 132.3, 118.9, 6),
                f_res_permit_visa_ar: posMm(page2, 151.7, 124.9, 6),
                f_res_permit_visa_from: posMm(page2, 148.2, 136.5, 6),
                f_res_permit_visa_to: posMm(page2, 176.4, 136.5, 6),

                f_proslipsidate: posMm(page2, 67.0, 163.7, 6),
                f_apoxwrisidate: posMm(page2, 67.0, 172.1, 6),
                f_apodoxes: posMm(page2, 74.1, 182.0, 6),
                f_eidikothta: posMm(page2, 67.0, 193.3, 6),
                f_xaraktirismos: posMm(page2, 137.6, 198.9, 6),
                f_kathestosapasxolisis: posMm(page2, 137.6, 215.9, 6),
                f_sxeshapasxolisis: posMm(page2, 137.6, 234.2, 6),
                f_orismenou_apo: posMm(page2, 149.9, 245.1, 6),
                f_orismenou_ews: posMm(page2, 176.4, 245.1, 6),
                f_comments: posMm(page2, 21.2, 258.9, 6)
            }
        };

        Object.entries(E5N_POSITIONS.page1).forEach(([field, pos]) => {
            drawField(page1, pdfData[field], pos);
        });

        Object.entries(E5N_POSITIONS.page2).forEach(([field, pos]) => {
            drawField(page2, pdfData[field], pos);
        });

        const pdfBytes = await pdfDoc.save();
        const pdfBuffer = Buffer.from(pdfBytes);

        const employeeId = String(ergazomenos._id || 'UNKNOWN');
        const eponymo = cleanFilePart(ergazomenos.eponymo);
        const onoma = cleanFilePart(ergazomenos.onoma);

        const filename = `${employeeId}_${eponymo}_${onoma}_${Date.now()}.pdf`;

        const companyNameClean = companyData?.eponymia
            ? cleanFilePart(companyData.eponymia).substring(0, 50)
            : 'UNKNOWN';

        const companyCode = companyData?.kod || companyData?.kodikos || 'UNKNOWN';
        const team = ergazomenos.team || companyData?.team || 'UNKNOWN_TEAM';

        const s3Key = `pdfs/${team}/${companyCode}_${companyNameClean}/E5N/${filename}`;

        const uploadResult = await uploadBufferToS3(pdfBuffer, s3Key, 'application/pdf');

        return {
            success: true,
            s3Key: uploadResult.s3Key,
            s3Url: uploadResult.s3Url || uploadResult.localPath,
            filename
        };
    } catch (error) {
        console.error('[E5N-TEMPLATE-PDF] Error:', error);

        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    generateE5NPdf,
    mm,
    fromTopMm,
    posMm,
    sm
};
