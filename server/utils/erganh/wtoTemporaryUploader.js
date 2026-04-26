// // wtoTemporaryUploader.js
// 'use strict';

// const fs = require('fs-extra');
// const path = require('path');
// const sessionManager = require('./sessionManager');

// const DEBUG = String(process.env.ERGANH_DEBUG || '').toLowerCase() === 'true';

// const TIMEOUTS = {
//     short: 5000,
//     medium: 12000,
//     long: 20000,
//     nav: 25000
// };

// function log(...a) {
//     console.log('[WTO-TEMP]', ...a);
// }

// function warn(...a) {
//     console.warn('[WTO-TEMP][WARN]', ...a);
// }

// function dbg(...a) {
//     if (DEBUG) console.log('[WTO-TEMP][DEBUG]', ...a);
// }

// async function snap(page, label) {
//     try {
//         await fs.ensureDir(path.join(process.cwd(), 'screenshots'));
//         const p = path.join(process.cwd(), 'screenshots', `${Date.now()}-${label}.png`);
//         await page.screenshot({ path: p, fullPage: true });
//         warn('[SCREENSHOT]', p);
//         return p;
//     } catch {
//         return null;
//     }
// }

// /**
//  * ✅ Parse ypokatasthma string to integer
//  * "0000" → 0, "0001" → 1, "0010" → 10, etc.
//  */
// function parseYpokatasthma(ypokatasthmaStr) {
//     if (!ypokatasthmaStr || typeof ypokatasthmaStr !== 'string') return null;

//     const trimmed = ypokatasthmaStr.trim();
//     const parsed = parseInt(trimmed, 10);

//     if (isNaN(parsed)) return null;

//     return parsed;
// }

// /**
//  * ✅ STEP 1: Click "ΧΡΟΝΟΣ ΕΡΓΑΣΙΑΣ" menu
//  */
// async function clickXronosErgasiasMenu(page) {
//     log('STEP 1: Clicking "ΧΡΟΝΟΣ ΕΡΓΑΣΙΑΣ" menu...');

//     // Wait for menu to be visible
//     const menuSelector = 'a.menu-dropdown:has-text("ΧΡΟΝΟΣ ΕΡΓΑΣΙΑΣ")';

//     await page.waitForSelector(menuSelector, { timeout: TIMEOUTS.long });

//     const menu = page.locator(menuSelector).first();

//     await menu.click({ timeout: TIMEOUTS.medium });

//     await page.waitForTimeout(500);

//     log('✅ STEP 1 complete');
// }

// /**
//  * ✅ STEP 2: Click "Ψηφιακή Οργάνωση Χρόνου Εργασίας" submenu
//  */
// async function clickPsifiadiOrganosiSubmenu(page) {
//     log('STEP 2: Clicking "Ψηφιακή Οργάνωση Χρόνου Εργασίας" submenu...');

//     const submenuSelector = 'a.menu-dropdown:has-text("Ψηφιακή Οργάνωση Χρόνου Εργασίας")';

//     await page.waitForSelector(submenuSelector, { timeout: TIMEOUTS.long });

//     const submenu = page.locator(submenuSelector).first();

//     await submenu.click({ timeout: TIMEOUTS.medium });

//     await page.waitForTimeout(500);

//     log('✅ STEP 2 complete');
// }

// /**
//  * ✅ STEP 3: Click "Εισαγωγή" link
//  */
// async function clickEisagogiLink(page) {
//     log('STEP 3: Clicking "Εισαγωγή" link...');

//     // Multiple possible selectors
//     const selectors = [
//         'a[href="/WTO/WorkingTimeOrganization.aspx"]',
//         'a:has-text("Εισαγωγή")',
//         'a[title*="Ψηφιακής Οργάνωσης"]:has-text("Εισαγωγή")'
//     ];

//     let clicked = false;

//     for (const selector of selectors) {
//         const count = await page.locator(selector).count();

//         if (count > 0) {
//             const link = page.locator(selector).first();

//             if (await link.isVisible().catch(() => false)) {
//                 await link.click({ timeout: TIMEOUTS.medium });
//                 clicked = true;
//                 break;
//             }
//         }
//     }

//     if (!clicked) {
//         const shot = await snap(page, 'eisagogi-link-not-found');
//         throw new Error(`"Εισαγωγή" link not found. Screenshot: ${shot || 'N/A'}`);
//     }

//     // Wait for navigation
//     await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav });

//     await page.waitForTimeout(1000);

//     log('✅ STEP 3 complete - navigated to WTO form');
// }

// /**
//  * ✅ STEP 4: Select Παράρτημα (branch) based on ypokatasthma
//  */
// async function selectPararthma(page, ypokatasthmaStr) {
//     log('STEP 4: Selecting Παράρτημα...');

//     const selectSelector =
//         'select#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_WorkingTimeOrganizationView_PararthmaSelection_PararthmaListEdit';

//     await page.waitForSelector(selectSelector, { timeout: TIMEOUTS.long });

//     const select = page.locator(selectSelector).first();

//     // Parse ypokatasthma
//     const branchValue = parseYpokatasthma(ypokatasthmaStr);

//     if (branchValue === null) {
//         throw new Error(`Invalid ypokatasthma value: ${ypokatasthmaStr}`);
//     }

//     log(`   Parsed ypokatasthma: "${ypokatasthmaStr}" → ${branchValue}`);

//     // Try to select by value
//     try {
//         await select.selectOption({ value: String(branchValue) }, { timeout: TIMEOUTS.medium });
//         log(`   ✅ Selected branch value: ${branchValue}`);
//     } catch (selectError) {
//         // If selection fails, list available options
//         const options = await page.evaluate((sel) => {
//             const selectEl = document.querySelector(sel);
//             return Array.from(selectEl.options).map((opt) => ({
//                 value: opt.value,
//                 text: opt.text
//             }));
//         }, selectSelector);

//         log('   Available branch options:', options);

//         throw new Error(
//             `Failed to select branch ${branchValue}. Available: ${JSON.stringify(options)}`
//         );
//     }

//     // Wait for postback
//     await page.waitForTimeout(1000);

//     log('✅ STEP 4 complete');
// }

// /**
//  * ✅ STEP 5: Select process type "182" (Σταθερό Εβδομαδιαίο)
//  */
// async function selectProcessType(page) {
//     log('STEP 5: Selecting process type "182" (Σταθερό Εβδομαδιαίο)...');

//     const selectSelector =
//         'select#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_WorkingTimeOrganizationView_SKYpobolesList';

//     await page.waitForSelector(selectSelector, { timeout: TIMEOUTS.long });

//     const select = page.locator(selectSelector).first();

//     try {
//         await select.selectOption({ value: '182' }, { timeout: TIMEOUTS.medium });
//         log('   ✅ Selected process type: 182');
//     } catch (selectError) {
//         // List available options
//         const options = await page.evaluate((sel) => {
//             const selectEl = document.querySelector(sel);
//             return Array.from(selectEl.options).map((opt) => ({
//                 value: opt.value,
//                 text: opt.text
//             }));
//         }, selectSelector);

//         log('   Available process options:', options);

//         throw new Error(`Failed to select process 182. Available: ${JSON.stringify(options)}`);
//     }

//     await page.waitForTimeout(500);

//     log('✅ STEP 5 complete');
// }

// /**
//  * ✅ STEP 6: Click "Εισαγωγή" button and confirm alert
//  */
// async function clickInsertButtonAndConfirm(page) {
//     log('STEP 6: Clicking "Εισαγωγή" button...');

//     const buttonSelector =
//         'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_WorkingTimeOrganizationView_InsertButton';

//     await page.waitForSelector(buttonSelector, { timeout: TIMEOUTS.long });

//     const button = page.locator(buttonSelector).first();

//     // ✅ Listen for browser alert dialog
//     page.once('dialog', async (dialog) => {
//         log(`   📢 Alert detected: "${dialog.message()}"`);
//         await dialog.accept();
//         log('   ✅ Alert accepted');
//     });

//     await button.click({ timeout: TIMEOUTS.medium });

//     // Wait for navigation after confirm
//     await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav });

//     await page.waitForTimeout(1000);

//     log('✅ STEP 6 complete - form submitted');
// }

// /**
//  * ✅ STEP 7: Fill "Από" date field (ergazomenos.hmeromhnia_allaghs_orarioy_apo)
//  */
// async function fillDateFromField(page, dateValue) {
//     log('STEP 7: Filling "Από" date field...');

//     // Parse date from MongoDB format (YYYY-MM-DD) to Greek format (DD/MM/YYYY)
//     let formattedDate = '';

//     if (dateValue) {
//         const dateObj = new Date(dateValue);
//         const day = String(dateObj.getDate()).padStart(2, '0');
//         const month = String(dateObj.getMonth() + 1).padStart(2, '0');
//         const year = dateObj.getFullYear();
//         formattedDate = `${day}/${month}/${year}`;
//     } else {
//         // Default to current date if not provided
//         const now = new Date();
//         const day = String(now.getDate()).padStart(2, '0');
//         const month = String(now.getMonth() + 1).padStart(2, '0');
//         const year = now.getFullYear();
//         formattedDate = `${day}/${month}/${year}`;
//     }

//     log(`   Formatted date: ${formattedDate}`);

//     // Multiple input IDs (visible text input)
//     const textInputSelector =
//         'input#igtxtctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_StoixeiaWorkingTimeOrganization_StoixeiaWorkingTimeOrganizationView_DateFromEdit';

//     await page.waitForSelector(textInputSelector, { timeout: TIMEOUTS.long });

//     const textInput = page.locator(textInputSelector).first();

//     // Fill the visible text input
//     await textInput.fill(formattedDate);

//     await page.waitForTimeout(500);

//     await page.evaluate(
//         ({ selector, value }) => {
//             const input = document.querySelector(selector);
//             if (input) {
//                 input.value = value;

//                 // Trigger change event
//                 const event = new Event('changeDate', { bubbles: true });
//                 input.dispatchEvent(event);

//                 // Also trigger the igedit update (custom library)
//                 if (typeof igedit_getById === 'function') {
//                     const editor = igedit_getById(
//                         'ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_StoixeiaWorkingTimeOrganization_StoixeiaWorkingTimeOrganizationView_DateFromEdit'
//                     );
//                     if (editor && typeof editor.setText === 'function') {
//                         editor.setText(value);
//                     }
//                 }
//             }
//         },
//         { selector: textInputSelector, value: formattedDate }
//     );

//     await page.waitForTimeout(500);

//     log('✅ STEP 7 complete');
// }

// /**
//  * ✅ STEP 8: Click "ΑΠΑΣΧΟΛΟΥΜΕΝΟΙ" tab
//  */
// async function clickApasxoloumenoiTab(page) {
//     log('STEP 8: Clicking "ΑΠΑΣΧΟΛΟΥΜΕΝΟΙ" tab...');

//     const tabSelector = 'a#ErgazomenoiWorkingTimeOrganizationTabId';

//     await page.waitForSelector(tabSelector, { timeout: TIMEOUTS.long });

//     const tab = page.locator(tabSelector).first();

//     await tab.click({ timeout: TIMEOUTS.medium });

//     await page.waitForTimeout(1000);

//     log('✅ STEP 8 complete');
// }

// /**
//  * ✅ STEP 9: Click "Προσθήκη" button (add employee to WTO)
//  */
// async function clickProsthikiButton(page) {
//     log('STEP 9: Clicking "Προσθήκη" button...');

//     const buttonSelector =
//         'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_AddButton';

//     await page.waitForSelector(buttonSelector, { timeout: TIMEOUTS.long });

//     const button = page.locator(buttonSelector).first();

//     await button.click({ timeout: TIMEOUTS.medium });

//     await page.waitForTimeout(1000);

//     log('✅ STEP 9 complete');
// }

// /**
//  * ✅ STEP 10-12: Fill employee details (AFM, Επώνυμο, Όνομα)
//  */
// async function fillEmployeeDetails(page, ergazomenosData) {
//     log('STEPS 10-12: Filling employee details...');

//     const { afm, eponymo, onoma } = ergazomenosData;

//     // =====================================================================
//     // STEP 10: Fill AFM
//     // =====================================================================

//     log('   STEP 10: Filling AFM...');

//     const afmSelector =
//         'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_AfmErgazomenosEdit';

//     await page.waitForSelector(afmSelector, { timeout: TIMEOUTS.long });

//     const afmInput = page.locator(afmSelector).first();

//     await afmInput.fill(afm || '');

//     await page.waitForTimeout(500);

//     // Trigger postback (onchange event)
//     await page.evaluate((selector) => {
//         const input = document.querySelector(selector);
//         if (input && typeof __doPostBack === 'function') {
//             __doPostBack(input.name, '');
//         }
//     }, afmSelector);

//     // Wait for postback to complete
//     await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav });

//     await page.waitForTimeout(1000);

//     log('   ✅ STEP 10 complete (AFM filled)');

//     // =====================================================================
//     // STEP 11: Fill Επώνυμο
//     // =====================================================================

//     log('   STEP 11: Filling Επώνυμο...');

//     const eponymoSelector =
//         'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_EponymoEdit';

//     await page.waitForSelector(eponymoSelector, { timeout: TIMEOUTS.long });

//     const eponymoInput = page.locator(eponymoSelector).first();

//     await eponymoInput.fill(eponymo || '');

//     await page.waitForTimeout(300);

//     log('   ✅ STEP 11 complete (Επώνυμο filled)');

//     // =====================================================================
//     // STEP 12: Fill Όνομα
//     // =====================================================================

//     log('   STEP 12: Filling Όνομα...');

//     const onomaSelector =
//         'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_OnomaEdit';

//     await page.waitForSelector(onomaSelector, { timeout: TIMEOUTS.long });

//     const onomaInput = page.locator(onomaSelector).first();

//     await onomaInput.fill(onoma || '');

//     await page.waitForTimeout(300);

//     log('   ✅ STEP 12 complete (Όνομα filled)');

//     log('✅ STEPS 10-12 complete - employee details filled');
// }

// /**
//  * ✅ STEP 13: Fetch weekly schedule from database
//  */
// async function fetchWeeklySchedule(ergazomenosData) {
//     log('STEP 13: Fetching weekly schedule from database...');

//     try {
//         // ✅ Import model
//         const { ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');

//         // ✅ Log input data
//         log('   Input data:', {
//             team: ergazomenosData.team,
//             company_kod: ergazomenosData.company_kod,
//             kodikos: ergazomenosData.kodikos,
//             hmeromhnia_apo: ergazomenosData.hmeromhnia_allaghs_orarioy_apo,
//             hmeromhnia_eos: ergazomenosData.hmeromhnia_allaghs_orarioy_eos
//         });

//         // ✅ Build query
//         const query = {
//             team: ergazomenosData.team,
//             company_kod: ergazomenosData.company_kod,
//             kodikos: ergazomenosData.kodikos
//         };

//         // ✅ Add date range filters (if available)
//         if (ergazomenosData.hmeromhnia_allaghs_orarioy_apo) {
//             query.hmeromhnia = {
//                 $gte: new Date(ergazomenosData.hmeromhnia_allaghs_orarioy_apo)
//             };
//         }

//         if (ergazomenosData.hmeromhnia_allaghs_orarioy_eos) {
//             query.hmeromhnia = query.hmeromhnia || {};
//             query.hmeromhnia.$lte = new Date(ergazomenosData.hmeromhnia_allaghs_orarioy_eos);
//         }

//         log('   Query:', JSON.stringify(query, null, 2));

//         // ✅ Fetch schedule records
//         const scheduleRecords = await ProdhlomenaOrariaModel.find(query)
//             .sort({ hmeromhnia: 1 }) // Sort by date ascending
//             .lean();

//         log(`   ✅ Found ${scheduleRecords.length} schedule records`);

//         if (scheduleRecords.length === 0) {
//             warn('   ⚠️ No schedule records found');
//             return [];
//         }

//         // ✅ Log sample data
//         log('   First record:', {
//             hmeromhnia: scheduleRecords[0].hmeromhnia,
//             kathgoria_ergasias: scheduleRecords[0].kathgoria_ergasias,
//             apo_ora_01: scheduleRecords[0].apo_ora_01,
//             eos_ora_01: scheduleRecords[0].eos_ora_01
//         });

//         if (scheduleRecords.length > 1) {
//             log('   Last record:', {
//                 hmeromhnia: scheduleRecords[scheduleRecords.length - 1].hmeromhnia,
//                 kathgoria_ergasias: scheduleRecords[scheduleRecords.length - 1].kathgoria_ergasias
//             });
//         }

//         log('✅ STEP 13 complete - schedule data loaded');

//         return scheduleRecords;
//     } catch (scheduleError) {
//         warn('❌ STEP 13 failed:', scheduleError.message);
//         warn('   Stack:', scheduleError.stack);

//         // ✅ Return empty array (don't throw - allow process to continue)
//         return [];
//     }
// }

// /**
//  * ✅ STEP 14: Fill weekly schedule table in ERGANH form
//  * Option B: Fill ALL non-empty slots (supports split shifts)
//  */
// async function fillWeeklyScheduleTable(page, scheduleRecords) {
//     log('STEP 14: Filling weekly schedule table...');

//     try {
//         // ✅ Day name mapping (Greek to English)
//         const dayMap = {
//             0: 'Sunday',
//             1: 'Monday',
//             2: 'Tuesday',
//             3: 'Wednesday',
//             4: 'Thursday',
//             5: 'Friday',
//             6: 'Saturday'
//         };

//         // ✅ Category to value mapping
//         const categoryValueMap = {
//             ΕΡΓ: '1-0',
//             ΤΗΛ: '2-0',
//             ΜΕ: '4-4',
//             ΑΝ: '3-4'
//         };

//         // ✅ Process each schedule record
//         for (const record of scheduleRecords) {
//             const date = new Date(record.hmeromhnia);
//             const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
//             const dayName = dayMap[dayIndex];

//             const category = (record.kathgoria_ergasias || '').trim().toUpperCase();

//             log(`   Processing ${dayName} (${date.toISOString().split('T')[0]}): ${category}`);

//             // ✅ Get category value
//             const categoryValue = categoryValueMap[category];

//             if (!categoryValue) {
//                 warn(`   ⚠️ Unknown category: ${category} - skipping`);
//                 continue;
//             }

//             // =====================================================================
//             // ✅ CASE 1: ΜΕ (ΜΗ ΕΡΓΑΣΙΑ) - Only Slot1, no time fields
//             // =====================================================================
//             if (category === 'ΜΕ') {
//                 const selectSelector = `select#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_WorkingCalendar_${dayName}_Slot1_TypeList`;

//                 try {
//                     await page.waitForSelector(selectSelector, { timeout: TIMEOUTS.medium });
//                     await page.selectOption(selectSelector, categoryValue);

//                     log(`   ✅ ${dayName}: Set ΜΗ ΕΡΓΑΣΙΑ (no times)`);
//                 } catch (err) {
//                     warn(`   ⚠️ ${dayName}: Failed to set ΜΗ ΕΡΓΑΣΙΑ:`, err.message);
//                 }

//                 continue;
//             }

//             // =====================================================================
//             // ✅ CASE 2: ΑΝ (ΑΝΑΠΑΥΣΗ/ΡΕΠΟ) - Only Slot1, no time fields
//             // =====================================================================
//             if (category === 'ΑΝ') {
//                 const selectSelector = `select#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_WorkingCalendar_${dayName}_Slot1_TypeList`;

//                 try {
//                     await page.waitForSelector(selectSelector, { timeout: TIMEOUTS.medium });
//                     await page.selectOption(selectSelector, categoryValue);

//                     log(`   ✅ ${dayName}: Set ΑΝΑΠΑΥΣΗ/ΡΕΠΟ (no times)`);
//                 } catch (err) {
//                     warn(`   ⚠️ ${dayName}: Failed to set ΑΝΑΠΑΥΣΗ/ΡΕΠΟ:`, err.message);
//                 }

//                 continue;
//             }

//             // =====================================================================
//             // ✅ CASE 3: ΕΡΓ or ΤΗΛ - Fill ALL non-empty time slots
//             // =====================================================================
//             const slots = [
//                 {
//                     num: 1,
//                     apo: record.apo_ora_01,
//                     eos: record.eos_ora_01
//                 },
//                 {
//                     num: 2,
//                     apo: record.apo_ora_02,
//                     eos: record.eos_ora_02
//                 },
//                 {
//                     num: 3,
//                     apo: record.apo_ora_03,
//                     eos: record.eos_ora_03
//                 }
//             ];

//             let filledSlotsCount = 0;

//             // ✅ Loop through ALL slots (no break!)
//             for (const slot of slots) {
//                 const hasApo = slot.apo && slot.apo.trim() !== '';
//                 const hasEos = slot.eos && slot.eos.trim() !== '';

//                 if (!hasApo || !hasEos) {
//                     // Skip empty slots
//                     continue;
//                 }

//                 // ✅ Fill this slot
//                 const slotNum = slot.num;

//                 const selectSelector = `select#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_WorkingCalendar_${dayName}_Slot${slotNum}_TypeList`;

//                 const apoSelector = `input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_WorkingCalendar_${dayName}_Slot${slotNum}_HourFromEdit`;

//                 const eosSelector = `input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_WorkingCalendar_${dayName}_Slot${slotNum}_HourToEdit`;

//                 try {
//                     // ✅ 1. Select category
//                     await page.waitForSelector(selectSelector, { timeout: TIMEOUTS.medium });
//                     await page.selectOption(selectSelector, categoryValue);

//                     // ✅ 2. Fill start time
//                     await page.waitForSelector(apoSelector, { timeout: TIMEOUTS.medium });
//                     await page.fill(apoSelector, slot.apo);

//                     // ✅ 3. Fill end time
//                     await page.waitForSelector(eosSelector, { timeout: TIMEOUTS.medium });
//                     await page.fill(eosSelector, slot.eos);

//                     log(`   ✅ ${dayName} Slot${slotNum}: ${category} ${slot.apo} - ${slot.eos}`);

//                     filledSlotsCount++;

//                     // ✅ NO BREAK - Continue to next slot!
//                 } catch (slotError) {
//                     warn(`   ⚠️ Failed to fill ${dayName} Slot${slotNum}:`, slotError.message);
//                 }
//             }

//             if (filledSlotsCount === 0) {
//                 warn(`   ⚠️ ${dayName}: No valid time slots found for ${category}`);
//             } else {
//                 log(`   ✅ ${dayName}: Filled ${filledSlotsCount} slot(s)`);
//             }
//         }

//         log('✅ STEP 14 complete - weekly schedule table filled');

//         return { success: true };
//     } catch (error) {
//         warn('❌ STEP 14 failed:', error.message);
//         const shot = await snap(page, 'step14-schedule-fill-failed');

//         return {
//             success: false,
//             error: error.message,
//             screenshot: shot
//         };
//     }
// }

// /**
//  * ✅ STEP 15: Click "Αποθήκευση" button to save WTO form
//  */
// async function clickSaveButton(page) {
//     log('STEP 15: Clicking "Αποθήκευση" button...');

//     const buttonSelector =
//         'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_InsertButton';

//     try {
//         // ✅ Wait for button to be visible
//         await page.waitForSelector(buttonSelector, { timeout: TIMEOUTS.long });

//         const button = page.locator(buttonSelector).first();

//         // ✅ Check if button is enabled
//         const isDisabled = await button.isDisabled();
//         if (isDisabled) {
//             warn('   ⚠️ Save button is disabled - form may have validation errors');
//             const shot = await snap(page, 'save-button-disabled');
//             return {
//                 success: false,
//                 error: 'Save button is disabled',
//                 screenshot: shot
//             };
//         }

//         // ✅ Click the button
//         await button.click({ timeout: TIMEOUTS.medium });

//         log('   ✅ Save button clicked');

//         // ✅ Wait for postback/navigation
//         await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav });

//         await page.waitForTimeout(2000);

//         // ✅ Check for success message or error
//         const successIndicators = [
//             'text=Η εγγραφή αποθηκεύτηκε επιτυχώς',
//             'text=Επιτυχής αποθήκευση',
//             '.alert-success',
//             '.success-message'
//         ];

//         let saveSuccess = false;

//         for (const indicator of successIndicators) {
//             const count = await page.locator(indicator).count();
//             if (count > 0) {
//                 saveSuccess = true;
//                 log('   ✅ Success message detected');
//                 break;
//             }
//         }

//         if (!saveSuccess) {
//             log('   ⚠️ No success message detected - checking for errors...');

//             // Check for error messages
//             const errorIndicators = [
//                 '.alert-danger',
//                 '.error-message',
//                 'text=Σφάλμα',
//                 'text=Error'
//             ];

//             for (const indicator of errorIndicators) {
//                 const count = await page.locator(indicator).count();
//                 if (count > 0) {
//                     const errorText = await page.locator(indicator).first().textContent();
//                     warn('   ❌ Error message found:', errorText);

//                     const shot = await snap(page, 'save-error');

//                     return {
//                         success: false,
//                         error: errorText || 'Unknown error during save',
//                         screenshot: shot
//                     };
//                 }
//             }

//             // No error found, assume success
//             log('   ✅ No error detected - assuming success');
//         }

//         log('✅ STEP 15 complete - form saved');

//         return { success: true };
//     } catch (error) {
//         warn('❌ STEP 15 failed:', error.message);
//         const shot = await snap(page, 'step15-save-failed');

//         return {
//             success: false,
//             error: error.message,
//             screenshot: shot
//         };
//     }
// }

// /**
//  * ✅ MAIN FUNCTION: Navigate WTO temporary upload flow
//  */
// async function navigateWtoTemporaryFlow(page, ypokatasthma, ergazomenosData) {
//     try {
//         log('Starting WTO temporary upload navigation...');
//         log('   ypokatasthma:', ypokatasthma);
//         log('   ergazomenosData:', ergazomenosData);

//         // STEP 1
//         await clickXronosErgasiasMenu(page);

//         // STEP 2
//         await clickPsifiadiOrganosiSubmenu(page);

//         // STEP 3
//         await clickEisagogiLink(page);

//         // STEP 4
//         await selectPararthma(page, ypokatasthma);

//         // STEP 5
//         await selectProcessType(page);

//         // STEP 6
//         await clickInsertButtonAndConfirm(page);

//         // STEP 7
//         await fillDateFromField(page, ergazomenosData.hmeromhnia_allaghs_orarioy_apo);

//         // STEP 8
//         await clickApasxoloumenoiTab(page);

//         // STEP 9
//         await clickProsthikiButton(page);

//         // STEPS 10-12
//         await fillEmployeeDetails(page, {
//             afm: ergazomenosData.afm,
//             eponymo: ergazomenosData.eponymo,
//             onoma: ergazomenosData.onoma
//         });

//         // ✅ STEP 13 - Fetch weekly schedule from database
//         const scheduleRecords = await fetchWeeklySchedule(ergazomenosData);

//         // ✅ STEP 14 - Fill schedule table (if records exist)
//         if (scheduleRecords.length > 0) {
//             const fillResult = await fillWeeklyScheduleTable(page, scheduleRecords);

//             if (!fillResult.success) {
//                 return {
//                     success: false,
//                     error: fillResult.error,
//                     screenshot: fillResult.screenshot
//                 };
//             }
//         } else {
//             log('⚠️ No schedule records found - skipping STEP 14');
//         }

//         // ✅ NEW: STEP 15 - Save form
//         const saveResult = await clickSaveButton(page);

//         if (!saveResult.success) {
//             return {
//                 success: false,
//                 error: saveResult.error,
//                 screenshot: saveResult.screenshot
//             };
//         }

//         log('✅ WTO temporary navigation complete (steps 1-15)');

//         return {
//             success: true,
//             message: 'WTO form saved successfully',
//             scheduleRecords: scheduleRecords
//         };
//     } catch (error) {
//         warn('WTO temporary navigation failed:', error.message);
//         const shot = await snap(page, 'wto-temp-nav-failed');

//         return {
//             success: false,
//             error: error.message,
//             screenshot: shot
//         };
//     }
// }

// /**
//  * ✅ EXPORT: Main entry point
//  */
// async function uploadWtoTemporary(
//     companyId,
//     xmlPath,
//     ergazomenosData,
//     userId = null,
//     creds = null
// ) {
//     let session = null;
//     let page = null;

//     try {
//         log('Getting or creating session...', { companyId });

//         // ✅ Reuse existing session (from E3 upload)
//         session = await sessionManager.getOrCreateSession(companyId, creds);
//         page = session.page;

//         // ✅ Navigate through WTO menu flow
//         const navResult = await navigateWtoTemporaryFlow(
//             page,
//             ergazomenosData.ypokatasthma,
//             ergazomenosData
//         );

//         if (!navResult.success) {
//             return {
//                 success: false,
//                 userMessage: 'Failed to complete WTO form',
//                 errorDetails: navResult.error,
//                 screenshot: navResult.screenshot
//             };
//         }

//         // ✅ Success message
//         return {
//             success: true,
//             userMessage: 'Επιτυχής Προσωρινή Αποθήκευση WTO (φόρμα αποθηκεύτηκε)',
//             protocol: null
//         };
//     } catch (error) {
//         warn('WTO temporary upload failed:', error.message);
//         const shot = page && !page.isClosed() ? await snap(page, 'wto-temp-final-fail') : null;

//         return {
//             success: false,
//             userMessage: 'Failed to upload WTO (temporary mode)',
//             errorDetails: error.message,
//             screenshot: shot
//         };
//     } finally {
//         // ✅ FIXED: Proper browser close check
//         if (session && session.browser) {
//             try {
//                 // ✅ Use isConnected() instead of isClosed()
//                 if (session.browser.isConnected()) {
//                     log('Closing browser session...');
//                     await session.browser.close();
//                     log('✅ Browser closed successfully');
//                 } else {
//                     log('⚠️ Browser already closed');
//                 }
//             } catch (closeError) {
//                 warn('⚠️ Failed to close browser:', closeError.message);
//             }
//         }

//         log('WTO temporary upload completed');
//     }
// }

// module.exports = { uploadWtoTemporary };

// wtoTemporaryUploader.js
'use strict';

const fs = require('fs-extra');
const path = require('path');
const sessionManager = require('./sessionManager');

const DEBUG = String(process.env.ERGANH_DEBUG || '').toLowerCase() === 'true';

const LOGIN_URL = 'https://eservices.yeka.gr/login.aspx';
const PORTAL_URL = 'https://eservices.yeka.gr/Default.aspx';

const SEL_LOGIN_USERNAME = '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_UserName';
const SEL_LOGIN_PASSWORD = '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Password';
const SEL_LOGIN_SUBMIT = '#ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Login';

const TIMEOUTS = {
    short: 5000,
    medium: 12000,
    long: 20000,
    nav: 25000
};

function log(...a) {
    console.log('[WTO-TEMP]', ...a);
}

function warn(...a) {
    console.warn('[WTO-TEMP][WARN]', ...a);
}

function dbg(...a) {
    if (DEBUG) console.log('[WTO-TEMP][DEBUG]', ...a);
}

async function snap(page, label) {
    try {
        await fs.ensureDir(path.join(process.cwd(), 'screenshots'));
        const p = path.join(process.cwd(), 'screenshots', `${Date.now()}-${label}.png`);
        await page.screenshot({ path: p, fullPage: true });
        warn('[SCREENSHOT]', p);
        return p;
    } catch {
        return null;
    }
}

// ============================================================================
// ✅ STEP 0 HELPERS: Login + Portal Navigation
// ============================================================================

async function isOnLoginForm(page) {
    const u = await page
        .locator(SEL_LOGIN_USERNAME)
        .count()
        .catch(() => 0);
    const p = await page
        .locator(SEL_LOGIN_PASSWORD)
        .count()
        .catch(() => 0);
    return !!(u && p);
}

async function doLogin(page, creds) {
    const username = creds?.username;
    const password = creds?.password;

    if (!username || !password) {
        throw new Error('Missing ERGANH credentials for WTO temporary upload');
    }

    log('Logging in to ERGANH...');

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.nav });

    await page.waitForSelector(SEL_LOGIN_USERNAME, { timeout: TIMEOUTS.long });

    await page.fill(SEL_LOGIN_USERNAME, username);
    await page.fill(SEL_LOGIN_PASSWORD, password);

    // ✅ Verify credentials were filled
    for (let i = 0; i < 3; i++) {
        const uVal = await page.inputValue(SEL_LOGIN_USERNAME).catch(() => '');
        const pVal = await page.inputValue(SEL_LOGIN_PASSWORD).catch(() => '');
        if (uVal && pVal) break;
        await page.fill(SEL_LOGIN_USERNAME, username);
        await page.fill(SEL_LOGIN_PASSWORD, password);
        await page.waitForTimeout(150);
    }

    await Promise.allSettled([
        page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav }).catch(() => {}),
        page.click(SEL_LOGIN_SUBMIT, { timeout: TIMEOUTS.medium })
    ]);

    await page.waitForTimeout(1000);

    log('✅ Login complete');
}

async function ensureLoggedInAndOnPortal(page, creds) {
    log('STEP 0: Ensuring logged in to ERGANH portal...');

    try {
        // ✅ Navigate to portal
        await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.nav });
        await page.waitForTimeout(500);

        // ✅ Check if redirected to login
        if (await isOnLoginForm(page)) {
            log('   Not logged in → logging in...');
            await doLogin(page, creds);

            // ✅ Navigate to portal after login
            await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.nav });
            await page.waitForTimeout(1000);
        }

        // ✅ Verify menu is visible
        const menuCount = await page
            .locator('a.menu-dropdown:has-text("ΧΡΟΝΟΣ ΕΡΓΑΣΙΑΣ")')
            .count()
            .catch(() => 0);

        if (menuCount === 0) {
            const shot = await snap(page, 'portal-menu-not-found');
            throw new Error(`Portal menu not found after login. Screenshot: ${shot || 'N/A'}`);
        }

        log('✅ STEP 0 complete - logged in and on portal');
    } catch (error) {
        const shot = await snap(page, 'step0-failed');
        throw new Error(`STEP 0 failed: ${error.message}. Screenshot: ${shot || 'N/A'}`);
    }
}

// ============================================================================
// ✅ HELPERS
// ============================================================================

/**
 * ✅ Parse ypokatasthma string to integer
 */
function parseYpokatasthma(ypokatasthmaStr) {
    if (!ypokatasthmaStr || typeof ypokatasthmaStr !== 'string') return null;
    const trimmed = ypokatasthmaStr.trim();
    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed)) return null;
    return parsed;
}

// ============================================================================
// ✅ STEP 1: Click "ΧΡΟΝΟΣ ΕΡΓΑΣΙΑΣ" menu
// ============================================================================
async function clickXronosErgasiasMenu(page) {
    log('STEP 1: Clicking "ΧΡΟΝΟΣ ΕΡΓΑΣΙΑΣ" menu...');

    const menuSelector = 'a.menu-dropdown:has-text("ΧΡΟΝΟΣ ΕΡΓΑΣΙΑΣ")';

    await page.waitForSelector(menuSelector, { timeout: TIMEOUTS.long });

    const menu = page.locator(menuSelector).first();

    await menu.click({ timeout: TIMEOUTS.medium });

    await page.waitForTimeout(500);

    log('✅ STEP 1 complete');
}

// ============================================================================
// ✅ STEP 2: Click "Ψηφιακή Οργάνωση Χρόνου Εργασίας" submenu
// ============================================================================
async function clickPsifiadiOrganosiSubmenu(page) {
    log('STEP 2: Clicking "Ψηφιακή Οργάνωση Χρόνου Εργασίας" submenu...');

    const submenuSelector = 'a.menu-dropdown:has-text("Ψηφιακή Οργάνωση Χρόνου Εργασίας")';

    await page.waitForSelector(submenuSelector, { timeout: TIMEOUTS.long });

    const submenu = page.locator(submenuSelector).first();

    await submenu.click({ timeout: TIMEOUTS.medium });

    await page.waitForTimeout(500);

    log('✅ STEP 2 complete');
}

// ============================================================================
// ✅ STEP 3: Click "Εισαγωγή" link
// ============================================================================
async function clickEisagogiLink(page) {
    log('STEP 3: Clicking "Εισαγωγή" link...');

    const selectors = [
        'a[href="/WTO/WorkingTimeOrganization.aspx"]',
        'a:has-text("Εισαγωγή")',
        'a[title*="Ψηφιακής Οργάνωσης"]:has-text("Εισαγωγή")'
    ];

    let clicked = false;

    for (const selector of selectors) {
        const count = await page.locator(selector).count();

        if (count > 0) {
            const link = page.locator(selector).first();

            if (await link.isVisible().catch(() => false)) {
                await link.click({ timeout: TIMEOUTS.medium });
                clicked = true;
                break;
            }
        }
    }

    if (!clicked) {
        const shot = await snap(page, 'eisagogi-link-not-found');
        throw new Error(`"Εισαγωγή" link not found. Screenshot: ${shot || 'N/A'}`);
    }

    await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav });

    await page.waitForTimeout(1000);

    log('✅ STEP 3 complete - navigated to WTO form');
}

// ============================================================================
// ✅ STEP 4: Select Παράρτημα (branch)
// ============================================================================
async function selectPararthma(page, ypokatasthmaStr) {
    log('STEP 4: Selecting Παράρτημα...');

    const selectSelector =
        'select#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_WorkingTimeOrganizationView_PararthmaSelection_PararthmaListEdit';

    await page.waitForSelector(selectSelector, { timeout: TIMEOUTS.long });

    const select = page.locator(selectSelector).first();

    const branchValue = parseYpokatasthma(ypokatasthmaStr);

    if (branchValue === null) {
        throw new Error(`Invalid ypokatasthma value: ${ypokatasthmaStr}`);
    }

    log(`   Parsed ypokatasthma: "${ypokatasthmaStr}" → ${branchValue}`);

    try {
        await select.selectOption({ value: String(branchValue) }, { timeout: TIMEOUTS.medium });
        log(`   ✅ Selected branch value: ${branchValue}`);
    } catch (selectError) {
        const options = await page.evaluate((sel) => {
            const selectEl = document.querySelector(sel);
            return Array.from(selectEl.options).map((opt) => ({
                value: opt.value,
                text: opt.text
            }));
        }, selectSelector);

        log('   Available branch options:', options);

        throw new Error(
            `Failed to select branch ${branchValue}. Available: ${JSON.stringify(options)}`
        );
    }

    await page.waitForTimeout(1000);

    log('✅ STEP 4 complete');
}

// ============================================================================
// ✅ STEP 5: Select process type "182"
// ============================================================================
async function selectProcessType(page) {
    log('STEP 5: Selecting process type "182" (Σταθερό Εβδομαδιαίο)...');

    const selectSelector =
        'select#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_WorkingTimeOrganizationView_SKYpobolesList';

    await page.waitForSelector(selectSelector, { timeout: TIMEOUTS.long });

    const select = page.locator(selectSelector).first();

    try {
        await select.selectOption({ value: '182' }, { timeout: TIMEOUTS.medium });
        log('   ✅ Selected process type: 182');
    } catch (selectError) {
        const options = await page.evaluate((sel) => {
            const selectEl = document.querySelector(sel);
            return Array.from(selectEl.options).map((opt) => ({
                value: opt.value,
                text: opt.text
            }));
        }, selectSelector);

        log('   Available process options:', options);

        throw new Error(`Failed to select process 182. Available: ${JSON.stringify(options)}`);
    }

    await page.waitForTimeout(500);

    log('✅ STEP 5 complete');
}

// ============================================================================
// ✅ STEP 6: Click "Εισαγωγή" button and confirm alert
// ============================================================================
async function clickInsertButtonAndConfirm(page) {
    log('STEP 6: Clicking "Εισαγωγή" button...');

    const buttonSelector =
        'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_WorkingTimeOrganizationView_InsertButton';

    await page.waitForSelector(buttonSelector, { timeout: TIMEOUTS.long });

    const button = page.locator(buttonSelector).first();

    page.once('dialog', async (dialog) => {
        log(`   📢 Alert detected: "${dialog.message()}"`);
        await dialog.accept();
        log('   ✅ Alert accepted');
    });

    await button.click({ timeout: TIMEOUTS.medium });

    await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav });

    await page.waitForTimeout(1000);

    log('✅ STEP 6 complete - form submitted');
}

// ============================================================================
// �� STEP 7: Fill "Από" date field
// ============================================================================
async function fillDateFromField(page, dateValue) {
    log('STEP 7: Filling "Από" date field...');

    let formattedDate = '';

    if (dateValue) {
        const dateObj = new Date(dateValue);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        formattedDate = `${day}/${month}/${year}`;
    } else {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        formattedDate = `${day}/${month}/${year}`;
    }

    log(`   Formatted date: ${formattedDate}`);

    const textInputSelector =
        'input#igtxtctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_StoixeiaWorkingTimeOrganization_StoixeiaWorkingTimeOrganizationView_DateFromEdit';

    await page.waitForSelector(textInputSelector, { timeout: TIMEOUTS.long });

    const textInput = page.locator(textInputSelector).first();

    await textInput.fill(formattedDate);

    await page.waitForTimeout(500);

    await page.evaluate(
        ({ selector, value }) => {
            const input = document.querySelector(selector);
            if (input) {
                input.value = value;
                const event = new Event('changeDate', { bubbles: true });
                input.dispatchEvent(event);
                if (typeof igedit_getById === 'function') {
                    const editor = igedit_getById(
                        'ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_StoixeiaWorkingTimeOrganization_StoixeiaWorkingTimeOrganizationView_DateFromEdit'
                    );
                    if (editor && typeof editor.setText === 'function') {
                        editor.setText(value);
                    }
                }
            }
        },
        { selector: textInputSelector, value: formattedDate }
    );

    await page.waitForTimeout(500);

    log('✅ STEP 7 complete');
}

// ============================================================================
// ✅ STEP 8: Click "ΑΠΑΣΧΟΛΟΥΜΕΝΟΙ" tab
// ============================================================================
async function clickApasxoloumenoiTab(page) {
    log('STEP 8: Clicking "ΑΠΑΣΧΟΛΟΥΜΕΝΟΙ" tab...');

    const tabSelector = 'a#ErgazomenoiWorkingTimeOrganizationTabId';

    await page.waitForSelector(tabSelector, { timeout: TIMEOUTS.long });

    const tab = page.locator(tabSelector).first();

    await tab.click({ timeout: TIMEOUTS.medium });

    await page.waitForTimeout(1000);

    log('✅ STEP 8 complete');
}

// ============================================================================
// ✅ STEP 9: Click "Προσθήκη" button
// ============================================================================
async function clickProsthikiButton(page) {
    log('STEP 9: Clicking "Προσθήκη" button...');

    const buttonSelector =
        'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_AddButton';

    await page.waitForSelector(buttonSelector, { timeout: TIMEOUTS.long });

    const button = page.locator(buttonSelector).first();

    await button.click({ timeout: TIMEOUTS.medium });

    await page.waitForTimeout(1000);

    log('✅ STEP 9 complete');
}

// ============================================================================
// ✅ STEPS 10-12: Fill employee details
// ============================================================================
async function fillEmployeeDetails(page, ergazomenosData) {
    log('STEPS 10-12: Filling employee details...');

    const { afm, eponymo, onoma } = ergazomenosData;

    // STEP 10: Fill AFM
    log('   STEP 10: Filling AFM...');

    const afmSelector =
        'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_AfmErgazomenosEdit';

    await page.waitForSelector(afmSelector, { timeout: TIMEOUTS.long });

    const afmInput = page.locator(afmSelector).first();

    await afmInput.fill(afm || '');

    await page.waitForTimeout(500);

    await page.evaluate((selector) => {
        const input = document.querySelector(selector);
        if (input && typeof __doPostBack === 'function') {
            __doPostBack(input.name, '');
        }
    }, afmSelector);

    await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav });

    await page.waitForTimeout(1000);

    log('   ✅ STEP 10 complete (AFM filled)');

    // STEP 11: Fill Επώνυμο
    log('   STEP 11: Filling Επώνυμο...');

    const eponymoSelector =
        'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_EponymoEdit';

    await page.waitForSelector(eponymoSelector, { timeout: TIMEOUTS.long });

    const eponymoInput = page.locator(eponymoSelector).first();

    await eponymoInput.fill(eponymo || '');

    await page.waitForTimeout(300);

    log('   ✅ STEP 11 complete (Επώνυμο filled)');

    // STEP 12: Fill Όνομα
    log('   STEP 12: Filling Όνομα...');

    const onomaSelector =
        'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_OnomaEdit';

    await page.waitForSelector(onomaSelector, { timeout: TIMEOUTS.long });

    const onomaInput = page.locator(onomaSelector).first();

    await onomaInput.fill(onoma || '');

    await page.waitForTimeout(300);

    log('   ✅ STEP 12 complete (Όνομα filled)');

    log('✅ STEPS 10-12 complete');
}

// ============================================================================
// ✅ STEP 13: Fetch weekly schedule from database
// ============================================================================
async function fetchWeeklySchedule(ergazomenosData) {
    log('STEP 13: Fetching weekly schedule from database...');

    try {
        const { ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');

        log('   Input data:', {
            team: ergazomenosData.team,
            company_kod: ergazomenosData.company_kod,
            kodikos: ergazomenosData.kodikos,
            hmeromhnia_apo: ergazomenosData.hmeromhnia_allaghs_orarioy_apo,
            hmeromhnia_eos: ergazomenosData.hmeromhnia_allaghs_orarioy_eos
        });

        const query = {
            team: ergazomenosData.team,
            company_kod: ergazomenosData.company_kod,
            kodikos: ergazomenosData.kodikos
        };

        if (ergazomenosData.hmeromhnia_allaghs_orarioy_apo) {
            query.hmeromhnia = {
                $gte: new Date(ergazomenosData.hmeromhnia_allaghs_orarioy_apo)
            };
        }

        if (ergazomenosData.hmeromhnia_allaghs_orarioy_eos) {
            query.hmeromhnia = query.hmeromhnia || {};
            query.hmeromhnia.$lte = new Date(ergazomenosData.hmeromhnia_allaghs_orarioy_eos);
        }

        log('   Query:', JSON.stringify(query, null, 2));

        const scheduleRecords = await ProdhlomenaOrariaModel.find(query)
            .sort({ hmeromhnia: 1 })
            .lean();

        log(`   ✅ Found ${scheduleRecords.length} schedule records`);

        if (scheduleRecords.length === 0) {
            warn('   ⚠️ No schedule records found');
            return [];
        }

        log('   First record:', {
            hmeromhnia: scheduleRecords[0].hmeromhnia,
            kathgoria_ergasias: scheduleRecords[0].kathgoria_ergasias,
            apo_ora_01: scheduleRecords[0].apo_ora_01,
            eos_ora_01: scheduleRecords[0].eos_ora_01
        });

        log('✅ STEP 13 complete');

        return scheduleRecords;
    } catch (scheduleError) {
        warn('❌ STEP 13 failed:', scheduleError.message);
        return [];
    }
}

// ============================================================================
// ✅ STEP 14: Fill weekly schedule table
// ============================================================================
async function fillWeeklyScheduleTable(page, scheduleRecords) {
    log('STEP 14: Filling weekly schedule table...');

    try {
        const dayMap = {
            0: 'Sunday',
            1: 'Monday',
            2: 'Tuesday',
            3: 'Wednesday',
            4: 'Thursday',
            5: 'Friday',
            6: 'Saturday'
        };

        const categoryValueMap = {
            ΕΡΓ: '1-0',
            ΤΗΛ: '2-0',
            ΜΕ: '4-4',
            ΑΝ: '3-4'
        };

        for (const record of scheduleRecords) {
            const date = new Date(record.hmeromhnia);
            const dayIndex = date.getDay();
            const dayName = dayMap[dayIndex];
            const category = (record.kathgoria_ergasias || '').trim().toUpperCase();

            log(`   Processing ${dayName} (${date.toISOString().split('T')[0]}): ${category}`);

            const categoryValue = categoryValueMap[category];

            if (!categoryValue) {
                warn(`   ⚠️ Unknown category: ${category} - skipping`);
                continue;
            }

            // ΜΕ - only Slot1, no times
            if (category === 'ΜΕ') {
                const selectSelector = `select#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_WorkingCalendar_${dayName}_Slot1_TypeList`;
                try {
                    await page.waitForSelector(selectSelector, { timeout: TIMEOUTS.medium });
                    await page.selectOption(selectSelector, categoryValue);
                    log(`   ✅ ${dayName}: Set ΜΗ ΕΡΓΑΣΙΑ`);
                } catch (err) {
                    warn(`   ⚠️ ${dayName}: Failed to set ΜΗ ΕΡΓΑΣΙΑ:`, err.message);
                }
                continue;
            }

            // ΑΝ - only Slot1, no times
            if (category === 'ΑΝ') {
                const selectSelector = `select#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_WorkingCalendar_${dayName}_Slot1_TypeList`;
                try {
                    await page.waitForSelector(selectSelector, { timeout: TIMEOUTS.medium });
                    await page.selectOption(selectSelector, categoryValue);
                    log(`   ✅ ${dayName}: Set ΑΝΑΠΑΥΣΗ/ΡΕΠΟ`);
                } catch (err) {
                    warn(`   ⚠️ ${dayName}: Failed to set ΑΝΑΠΑΥΣΗ/ΡΕΠΟ:`, err.message);
                }
                continue;
            }

            // ΕΡΓ / ΤΗΛ - fill all non-empty time slots
            const slots = [
                { num: 1, apo: record.apo_ora_01, eos: record.eos_ora_01 },
                { num: 2, apo: record.apo_ora_02, eos: record.eos_ora_02 },
                { num: 3, apo: record.apo_ora_03, eos: record.eos_ora_03 }
            ];

            let filledSlotsCount = 0;

            for (const slot of slots) {
                const hasApo = slot.apo && slot.apo.trim() !== '';
                const hasEos = slot.eos && slot.eos.trim() !== '';

                if (!hasApo || !hasEos) continue;

                const slotNum = slot.num;

                const selectSelector = `select#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_WorkingCalendar_${dayName}_Slot${slotNum}_TypeList`;
                const apoSelector = `input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_WorkingCalendar_${dayName}_Slot${slotNum}_HourFromEdit`;
                const eosSelector = `input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_WorkingCalendar_${dayName}_Slot${slotNum}_HourToEdit`;

                try {
                    await page.waitForSelector(selectSelector, { timeout: TIMEOUTS.medium });
                    await page.selectOption(selectSelector, categoryValue);

                    await page.waitForSelector(apoSelector, { timeout: TIMEOUTS.medium });
                    await page.fill(apoSelector, slot.apo);

                    await page.waitForSelector(eosSelector, { timeout: TIMEOUTS.medium });
                    await page.fill(eosSelector, slot.eos);

                    log(`   ✅ ${dayName} Slot${slotNum}: ${category} ${slot.apo} - ${slot.eos}`);
                    filledSlotsCount++;
                } catch (slotError) {
                    warn(`   ⚠️ Failed to fill ${dayName} Slot${slotNum}:`, slotError.message);
                }
            }

            if (filledSlotsCount === 0) {
                warn(`   ⚠️ ${dayName}: No valid time slots found for ${category}`);
            } else {
                log(`   ✅ ${dayName}: Filled ${filledSlotsCount} slot(s)`);
            }
        }

        log('✅ STEP 14 complete');
        return { success: true };
    } catch (error) {
        warn('❌ STEP 14 failed:', error.message);
        const shot = await snap(page, 'step14-schedule-fill-failed');
        return { success: false, error: error.message, screenshot: shot };
    }
}

// ============================================================================
// ✅ STEP 15: Click "Αποθήκευση" button
// ============================================================================
async function clickSaveButton(page) {
    log('STEP 15: Clicking "Αποθήκευση" button...');

    const buttonSelector =
        'input#ctl00_ctl00_ContentHolder_ContentHolder_WorkingTimeOrganizationControl_ErgazomenoiWorkingTimeOrganization_ErgazomenosWorkingTimeOrganization_ErgazomenosWorkingTimeOrganizationView_InsertButton';

    try {
        await page.waitForSelector(buttonSelector, { timeout: TIMEOUTS.long });

        const button = page.locator(buttonSelector).first();

        const isDisabled = await button.isDisabled();
        if (isDisabled) {
            warn('   ⚠️ Save button is disabled');
            const shot = await snap(page, 'save-button-disabled');
            return { success: false, error: 'Save button is disabled', screenshot: shot };
        }

        await button.click({ timeout: TIMEOUTS.medium });

        log('   ✅ Save button clicked');

        await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.nav });
        await page.waitForTimeout(2000);

        const successIndicators = [
            'text=Η εγγραφή αποθηκεύτηκε επιτυχώς',
            'text=Επιτυχής αποθήκευση',
            '.alert-success',
            '.success-message'
        ];

        let saveSuccess = false;
        for (const indicator of successIndicators) {
            const count = await page.locator(indicator).count();
            if (count > 0) {
                saveSuccess = true;
                log('   ✅ Success message detected');
                break;
            }
        }

        if (!saveSuccess) {
            const errorIndicators = [
                '.alert-danger',
                '.error-message',
                'text=Σφάλμα',
                'text=Error'
            ];
            for (const indicator of errorIndicators) {
                const count = await page.locator(indicator).count();
                if (count > 0) {
                    const errorText = await page.locator(indicator).first().textContent();
                    warn('   ❌ Error message found:', errorText);
                    const shot = await snap(page, 'save-error');
                    return {
                        success: false,
                        error: errorText || 'Unknown error',
                        screenshot: shot
                    };
                }
            }
            log('   ✅ No error detected - assuming success');
        }

        log('✅ STEP 15 complete');
        return { success: true };
    } catch (error) {
        warn('❌ STEP 15 failed:', error.message);
        const shot = await snap(page, 'step15-save-failed');
        return { success: false, error: error.message, screenshot: shot };
    }
}

// ============================================================================
// ✅ MAIN NAVIGATION FLOW (Steps 0-15)
// ============================================================================
async function navigateWtoTemporaryFlow(page, ypokatasthma, ergazomenosData, creds) {
    try {
        log('Starting WTO temporary upload navigation...');
        log('   ypokatasthma:', ypokatasthma);
        log('   ergazomenosData:', ergazomenosData);

        // ✅ STEP 0: Ensure logged in
        await ensureLoggedInAndOnPortal(page, creds);

        // STEP 1
        await clickXronosErgasiasMenu(page);

        // STEP 2
        await clickPsifiadiOrganosiSubmenu(page);

        // STEP 3
        await clickEisagogiLink(page);

        // STEP 4
        await selectPararthma(page, ypokatasthma);

        // STEP 5
        await selectProcessType(page);

        // STEP 6
        await clickInsertButtonAndConfirm(page);

        // STEP 7
        await fillDateFromField(page, ergazomenosData.hmeromhnia_allaghs_orarioy_apo);

        // STEP 8
        await clickApasxoloumenoiTab(page);

        // STEP 9
        await clickProsthikiButton(page);

        // STEPS 10-12
        await fillEmployeeDetails(page, {
            afm: ergazomenosData.afm,
            eponymo: ergazomenosData.eponymo,
            onoma: ergazomenosData.onoma
        });

        // STEP 13
        const scheduleRecords = await fetchWeeklySchedule(ergazomenosData);

        // STEP 14
        if (scheduleRecords.length > 0) {
            const fillResult = await fillWeeklyScheduleTable(page, scheduleRecords);
            if (!fillResult.success) {
                return {
                    success: false,
                    error: fillResult.error,
                    screenshot: fillResult.screenshot
                };
            }
        } else {
            log('⚠️ No schedule records found - skipping STEP 14');
        }

        // STEP 15
        const saveResult = await clickSaveButton(page);
        if (!saveResult.success) {
            return { success: false, error: saveResult.error, screenshot: saveResult.screenshot };
        }

        log('✅ WTO temporary navigation complete (steps 0-15)');

        return {
            success: true,
            message: 'WTO form saved successfully',
            scheduleRecords: scheduleRecords
        };
    } catch (error) {
        warn('WTO temporary navigation failed:', error.message);
        const shot = await snap(page, 'wto-temp-nav-failed');
        return { success: false, error: error.message, screenshot: shot };
    }
}

// ============================================================================
// ✅ EXPORT: Main entry point
// ============================================================================
async function uploadWtoTemporary(
    companyId,
    xmlPath,
    ergazomenosData,
    userId = null,
    creds = null
) {
    let session = null;
    let page = null;

    try {
        log('Getting or creating session...', { companyId });

        session = await sessionManager.getOrCreateSession(companyId, creds);
        page = session.page;

        // ✅ Pass creds to navigateWtoTemporaryFlow
        const navResult = await navigateWtoTemporaryFlow(
            page,
            ergazomenosData.ypokatasthma,
            ergazomenosData,
            creds // ✅ ΝΕΟ: περνάμε τα creds
        );

        if (!navResult.success) {
            return {
                success: false,
                userMessage: 'Failed to complete WTO form',
                errorDetails: navResult.error,
                screenshot: navResult.screenshot
            };
        }

        return {
            success: true,
            userMessage: 'Επιτυχής Προσωρινή Αποθήκευση WTO (φόρμα αποθηκεύτηκε)',
            protocol: null
        };
    } catch (error) {
        warn('WTO temporary upload failed:', error.message);
        const shot = page && !page.isClosed() ? await snap(page, 'wto-temp-final-fail') : null;

        return {
            success: false,
            userMessage: 'Failed to upload WTO (temporary mode)',
            errorDetails: error.message,
            screenshot: shot
        };
    } finally {
        if (session && session.browser) {
            try {
                if (session.browser.isConnected()) {
                    log('Closing browser session...');
                    await session.browser.close();
                    log('✅ Browser closed successfully');
                } else {
                    log('⚠️ Browser already closed');
                }
            } catch (closeError) {
                warn('⚠️ Failed to close browser:', closeError.message);
            }
        }

        log('WTO temporary upload completed');
    }
}

module.exports = { uploadWtoTemporary };
