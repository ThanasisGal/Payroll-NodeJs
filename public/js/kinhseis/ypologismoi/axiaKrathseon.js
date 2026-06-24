// export async function ypologismosAxiasKrathseon(sharedParams) {
async function ypologismosAxiasKrathseon(sharedParams) {
    //  Κύρια Συνάρτηση: ypologismosAxiasKrathseon
    async function ypologismosAxiasKrathseon(sharedParams) {
      // 12. Flag για Αποφυγή Αναδρομικών Ενημερώσεων
      let isUpdating = false; // Δήλωση στην αρχή

      // 13. Μεταβλητή για την Παρακολούθηση της Προηγούμενης Τιμής
      let previousValue = 0; // Αρχική τιμή, θα ενημερωθεί στην αρχικοποίηση

      //  1. ΔΗΛΩΝΟΥΜΕ ΒΑΣΙΚΑ ΠΕΔΙΑ
      const asfalistikesApodoxes = document.getElementById('asfalistikes_apodoxes');
      const asfalistikesApodoxesHidden = document.getElementById('asfalistikes_apodoxes_hidden');
      const synoloMiktonApodoxon = document.getElementById('synoloMiktonApodoxon');

      // Έλεγχος ύπαρξης βασικών πεδίων
      if (!asfalistikesApodoxes) {
          console.error('Το στοιχείο "asfalistikes_apodoxes" δεν βρέθηκε στο DOM.');
          return;
      }
      if (!asfalistikesApodoxesHidden) {
          console.error('Το στοιχείο "asfalistikes_apodoxes_hidden" δεν βρέθηκε στο DOM.');
          return;
      }
      if (!synoloMiktonApodoxon) {
          console.error('Το στοιχείο "synoloMiktonApodoxon" δεν βρέθηκε στο DOM.');
          return;
      }

      /***************************************************************
       * 2. Πεδία συνόλων κρατήσεων
       ***************************************************************/
      const synoloAxiasFields = {
          ergazomenoy: document.getElementById('synolo_axias_krathshs_ergazomenoy'),
          ergodoth: document.getElementById('synolo_axias_krathshs_ergodoth'),
          ergazomenoyYpologizomenhStoForo: document.getElementById('synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro'),
          ergazomenoyMhYpologizomenhStoForo: document.getElementById('synolo_axias_krathshs_ergazomenoy_mh_ypologizomenh_sto_foro'),
          ergodothYpologizomenhStoForo: document.getElementById('synolo_axias_krathshs_ergodoth_ypologizomenh_sto_foro'),
          ergodothMhYpologizomenhStoForo: document.getElementById('synolo_axias_krathshs_ergodoth_mh_ypologizomenh_sto_foro'),
          krathseon: document.getElementById('synoloKrathseon_I'),
      };

      // Άλλα πεδία που μπορεί να χρειάζεσαι
      const plhroteoField = document.getElementById('plhroteo');
      const meioshErgatikhsEisforas = document.getElementById('meioshErgatikhsEisforas');

      /***************************************************************
       * 3. ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ
       ***************************************************************/
      // 3.1 Μορφοποίηση αριθμών για το input (με τελεία)
      function formatNumberForInput(value, decimals = 2) {
          const num = parseFloat(value || '0');
          if (isNaN(num)) return '0.00';
          return num.toFixed(decimals);
      }

      // 3.2 Μορφοποίηση αριθμών για εμφάνιση (με κόμμα)
      function formatNumberForDisplay(value, decimals = 2) {
          const num = parseFloat(value || '0');
          if (isNaN(num)) return '0,00';
          return num.toFixed(decimals).replace('.', ',');
      }

      function formatKrathseisCurrency2(value) {
          if (typeof window.formatKrathseisCurrency2 === 'function') {
              return window.formatKrathseisCurrency2(value);
          }

          if (typeof value === 'string' && value.trim() === '') return '';

          const normalizedValue = String(value ?? '').trim().replace(',', '.');
          if (normalizedValue === '') return '';

          const parsedValue = Number(normalizedValue);
          return Number.isFinite(parsedValue) ? parsedValue.toFixed(2) : '';
      }

      // 3.3 getAnotatoOrio - Υπολογισμός του ανώτατου ορίου από sharedParams
      function getAnotatoOrio(index) {
          if (!sharedParams?.ergazomenoi || typeof sharedParams.ergazomenoi.palios_neos === 'undefined') {
              // Αν δεν ξέρουμε αν είναι παλιός/νέος, χρησιμοποιούμε μέγιστη τιμή
              return Number.MAX_VALUE;
          }

          const isNeos = sharedParams.ergazomenoi.palios_neos === true;
          const fieldId = isNeos
              ? `anotato_orio_neon_${index}`
              : `anotato_orio_palion_${index}`;

          const el = document.getElementById(fieldId);
          if (!el) {
              console.error(`Το στοιχείο με το ID "${fieldId}" δεν βρέθηκε στο DOM.`);
              return Number.MAX_VALUE;
          }

          const val = parseFloat((el.value || '0').replace(',', '.'));
          return isNaN(val) ? Number.MAX_VALUE : val;
      }

      /***************************************************************
       * 4. (ΝΕΟ) Συναρτήσεις για φόρτωση «πλασματικής αξίας» από τη βάση
       ***************************************************************/
      // Εδώ ορίζουμε την τρέχουσα μισθολογική περίοδο, π.χ. Οκτώβριος 2024 (1/10 - 31/10).
      const arxh_periodoy = new Date(document.getElementById("etos").value + "-" + document.getElementById("periodos").value + "-01T00:00:00.000Z");
      const telosPeriodoy = new Date(arxh_periodoy);
      telosPeriodoy.setMonth(arxh_periodoy.getMonth() + 1);
      
      // Αφαίρεση ενός μιλλιδευτερόλεπτου για να βρούμε το τέλος της περιόδου
      telosPeriodoy.setMilliseconds(telosPeriodoy.getMilliseconds() - 1);
      const telos_periodoy = new Date(telosPeriodoy);

      const startPeriod = arxh_periodoy;
      const endPeriod   = telos_periodoy;

      // 4.1 Συνάρτηση που ελέγχει αν μια εγγραφή PosostaKrathseon καλύπτει την περίοδο
      function isWithinPeriod(posostaDoc) {
          const isxyeiApo = posostaDoc.isxyei_apo ? new Date(posostaDoc.isxyei_apo) : null;
          const isxyeiEos = posostaDoc.isxyei_eos ? new Date(posostaDoc.isxyei_eos) : null;

          if (!isxyeiApo || !isxyeiEos) {
              return false; // Δεν έχουμε σωστές ημερομηνίες
          }

          // Θέλουμε: 
          //   startPeriod >= isxyei_apo AND endPeriod <= isxyei_eos
          //   Δλδ να «περικλείει» η περίοδος των ημερομηνιών μας από το range.
          if (startPeriod >= isxyeiApo && endPeriod <= isxyeiEos) {
              return true;
          }
          return false;
      }

      /***************************************************************
       * 5. Αρχικοποίηση: initializeInitialValues
       *    + Φόρτωση πλασματικής αξίας από DB αν χρειάζεται
       ***************************************************************/
      async function initializeInitialValues() {
          for (let i = 1; i <= 7; i++) {
              const idx = i.toString().padStart(2, '0');
              const field = document.getElementById(`asfalistikesApodoxes_${idx}`);
              if (!field) continue;
      
              // (Α) Παίρνουμε την τρέχουσα τιμή σαν 'safeVal'
              const asfVal = parseFloat((field.value || '0').replace(',', '.'));
              const safeVal = isNaN(asfVal) ? 0 : asfVal;
      
              // (Β) Αποθηκεύουμε στα dataset
              field.dataset.initialValue = safeVal;
              field.dataset.previousValue = safeVal;
      
              // (Γ) Φέρνουμε τον kodikos_XX (αν υπάρχει κάπου στο DOM).
              const kodikosEl = document.getElementById(`kodikos_${idx}`);
              let kodikosVal = '';
              if (kodikosEl) {
                  kodikosVal = (kodikosEl.value || '').trim();
              }
      
              // (Γ1) Φόρτωση τυχόν κρυφών πεδίων για πλασματική αξία
              const epiPlasmatikhsEl = document.getElementById(`ypologizomenoEpiPlasmatikhs_${idx}`);
              const plasmatikhAxiaEl = document.getElementById(`plasmatikh_axia_${idx}`);
      
              // Αν υπάρχουν κρυφά πεδία, ελέγχουμε την τιμή τους
              let alreadyKnownPlasmatikh = false;
              if (epiPlasmatikhsEl && plasmatikhAxiaEl) {
                  const isPlasmatikhs = epiPlasmatikhsEl.value === 'true'; 
                  const plasmatikhVal = parseFloat((plasmatikhAxiaEl.value || '0').replace(',', '.'));
      
                  if (isPlasmatikhs && !isNaN(plasmatikhVal)) {
                      // => Γνωρίζουμε ήδη ότι είναι πλασματική, βάζουμε την τιμή
                      field.value = formatNumberForInput(plasmatikhVal, 2);
                      field.dataset.isPlasmatikh = 'true';
                      alreadyKnownPlasmatikh = true;
                  }
              }
          }
      }
      
      /***************************************************************
       * 6. Υπολογισμός Κρατήσεων: calculateValues
       ***************************************************************/
      async function calculateValues() {
          const totals = {
              ergazomenoy: 0,
              ergodoth: 0,
              ergazomenoyYpologizomenhStoForo: 0,
              ergazomenoyMhYpologizomenhStoForo: 0,
              ergodothYpologizomenhStoForo: 0,
              ergodothMhYpologizomenhStoForo: 0,
          };

          for (let i = 1; i <= 7; i++) {
              const idx = i.toString().padStart(2, '0');
              const fields = {
                  asfalistikesApodoxes: document.getElementById(`asfalistikesApodoxes_${idx}`),
                  posostoErgazomenoy: document.getElementById(`pososto_krathshs_ergazomenoy_${idx}`),
                  posostoErgodoth: document.getElementById(`pososto_krathshs_ergodoth_${idx}`),
                  posoErgazomenoy: document.getElementById(`poso_krathshs_ergazomenoy_${idx}`),
                  posoErgodoth: document.getElementById(`poso_krathshs_ergodoth_${idx}`),
                  axiaErgazomenoy: document.getElementById(`axia_krathshs_ergazomenoy_${idx}`),
                  axiaErgodoth: document.getElementById(`axia_krathshs_ergodoth_${idx}`),
                  ypologizomenoStoForo: document.getElementById(`ypologizomenoStoForo_${idx}`),
              };

              if (
                  !fields.asfalistikesApodoxes ||
                  !fields.posostoErgazomenoy ||
                  !fields.posostoErgodoth ||
                  !fields.ypologizomenoStoForo
              ) {
                  continue;
              }

              // Ελέγχουμε αν είναι «κλειδωμένο» σε πλασματική
              const isPlasmatikh = fields.asfalistikesApodoxes.dataset.isPlasmatikh === 'true';

              let asfVal = parseFloat((fields.asfalistikesApodoxes.value || '0').replace(',', '.'));
              if (isNaN(asfVal)) asfVal = 0;

              // Αν ΔΕΝ είναι πλασματική, μπορεί να υπόκειται σε ανώτατο όριο
              let adjustedVal = asfVal;
              if (!isPlasmatikh) {
                  const anotatoOrio = getAnotatoOrio(idx);
                  adjustedVal = Math.min(asfVal, anotatoOrio);
              }

              // Ποσοστά και ποσά κράτησης
              const pErgaz = parseFloat((fields.posostoErgazomenoy.value || '0').replace(',', '.')) / 100;
              const pErgod = parseFloat((fields.posostoErgodoth.value || '0').replace(',', '.')) / 100;
              const psErg = parseFloat((fields.posoErgazomenoy.value || '0').replace(',', '.'));
              const psErd = parseFloat((fields.posoErgodoth.value || '0').replace(',', '.'));

              const axiaErgaz = adjustedVal * pErgaz + (psErg || 0);
              const axiaErgod = adjustedVal * pErgod + (psErd || 0);

              // Προσθέτουμε στα totals
              totals.ergazomenoy += axiaErgaz;
              totals.ergodoth += axiaErgod;

              // Αν υπολογίζεται στο φόρο...
              if (fields.ypologizomenoStoForo.value.toLowerCase() === 'true') {
                  totals.ergazomenoyYpologizomenhStoForo += axiaErgaz;
                  totals.ergodothYpologizomenhStoForo += axiaErgod;
              } else {
                  totals.ergazomenoyMhYpologizomenhStoForo += axiaErgaz;
                  totals.ergodothMhYpologizomenhStoForo += axiaErgod;
              }

              // Ενημερώνουμε τις εμφανιζόμενες αξίες στα αντίστοιχα πεδία (με τελεία, 2 δεκαδικά)
              if (fields.axiaErgazomenoy) {
                  fields.axiaErgazomenoy.value = formatKrathseisCurrency2(axiaErgaz);
              }
              if (fields.axiaErgodoth) {
                  fields.axiaErgodoth.value = formatKrathseisCurrency2(axiaErgod);
              }
          }

          // Ενημέρωση συνόλων αξίας κρατήσεων με τελεία και 2 δεκαδικά
          if (synoloAxiasFields.ergazomenoy) {
              synoloAxiasFields.ergazomenoy.value = formatKrathseisCurrency2(totals.ergazomenoy);
          }
          if (synoloAxiasFields.ergodoth) {
              synoloAxiasFields.ergodoth.value = formatKrathseisCurrency2(totals.ergodoth);
          }
          if (synoloAxiasFields.ergazomenoyYpologizomenhStoForo) {
              synoloAxiasFields.ergazomenoyYpologizomenhStoForo.value =
                  formatKrathseisCurrency2(totals.ergazomenoyYpologizomenhStoForo);
          }
          if (synoloAxiasFields.ergazomenoyMhYpologizomenhStoForo) {
              synoloAxiasFields.ergazomenoyMhYpologizomenhStoForo.value =
                  formatKrathseisCurrency2(totals.ergazomenoyMhYpologizomenhStoForo);
          }
          if (synoloAxiasFields.ergodothYpologizomenhStoForo) {
              synoloAxiasFields.ergodothYpologizomenhStoForo.value =
                  formatKrathseisCurrency2(totals.ergodothYpologizomenhStoForo);
          }
          if (synoloAxiasFields.ergodothMhYpologizomenhStoForo) {
              synoloAxiasFields.ergodothMhYpologizomenhStoForo.value =
                  formatKrathseisCurrency2(totals.ergodothMhYpologizomenhStoForo);
          }

          // Για παράδειγμα, το σύνολο των κρατήσεων (εργαζόμενου) στο πεδίο krathseon
          if (synoloAxiasFields.krathseon) {
              synoloAxiasFields.krathseon.value = formatNumberForDisplay(totals.ergazomenoy, 2);
          }

          // Αν υπάρχει κάποια συνάρτηση calcPlhroteo() για έξτρα υπολογισμούς
          if (typeof calcPlhroteo === 'function') {
              await calcPlhroteo();
          }

          if (typeof window.scheduleKrathseisAmountsFormatting === 'function') {
              window.scheduleKrathseisAmountsFormatting();
          } else if (typeof window.formatKrathseisAmountsForDisplay === 'function') {
              window.formatKrathseisAmountsForDisplay();
          }
      }

      /***************************************************************
       * 7. Συνάρτηση: updateAsfalistikesApodoxesXX
       *    Ενημερώνει όλα τα πεδία asfalistikesApodoxes_XX, ΕΚΤΟΣ
       *    από εκείνα που είναι «κλειδωμένα» σε πλασματική αξία.
       ***************************************************************/
      function updateAsfalistikesApodoxesXX(newValue) {
          for (let i = 1; i <= 7; i++) {
              const idx = i.toString().padStart(2, '0');
              const field = document.getElementById(`asfalistikesApodoxes_${idx}`);

              if (!field) continue;

              // Αν αυτό το πεδίο είναι «κλειδωμένο» σε πλασματική, το προσπερνάμε
              if (field.dataset.isPlasmatikh === 'true') {
                  continue;
              }

              // Παίρνουμε το ανώτατο όριο (μόνο για ενημέρωση visual, η ουσία γίνεται στο calculate)
              const anotato = getAnotatoOrio(idx);
              const updatedVal = Math.min(newValue, anotato);

              field.value = formatNumberForInput(updatedVal, 2);
          }
      }

      /***************************************************************
       * 8. Συνάρτηση: handleSynoloMiktonChange
       *    Όταν αλλάζει το "synoloMiktonApodoxon", ενημερώνουμε
       *    asfalistikesApodoxes και τα επιμέρους πεδία
       ***************************************************************/
      async function handleSynoloMiktonChange() {
          let miktesApodoxesPlusAstheneia = parseFloat(synoloMiktonApodoxon.value || '0') + parseFloat(document.getElementById("geniko_synolo_astheneias").value || 0)
          let newVal = parseFloat(miktesApodoxesPlusAstheneia || '0');
          // let newVal = parseFloat((synoloMiktonApodoxon.value || '0').replace(',', '.'));
          if (isNaN(newVal)) {
              newVal = 0;
          }

          // Ενημέρωση asfalistikesApodoxes value
          isUpdating = true;
          asfalistikesApodoxes.value = formatNumberForInput(newVal, 2);
          isUpdating = false;

          // Ενημέρωση ΚΑΘΕ asfalistikesApodoxes_XX (εκτός των κλειδωμένων)
          updateAsfalistikesApodoxesXX(newVal);

          // Ενημέρωση previousValue
          previousValue = newVal;

          // Recalculate values
          await calculateValues();
      }

      /***************************************************************
       * 9. Συνάρτηση: handleAsfalistikesApodoxesChange
       ***************************************************************/
      async function handleAsfalistikesApodoxesChange() {
          // Αν το flag isUpdating είναι ενεργό, αγνοούμε την αλλαγή
          if (isUpdating) {
              console.log('Change ignored due to isUpdating flag.');
              return;
          }

          // Αποθήκευση της προηγούμενης τιμής
          const oldValue = previousValue;
          let newVal = parseFloat((asfalistikesApodoxes.value || '0').replace(',', '.'));
          if (isNaN(newVal)) {
              newVal = 0;
          }

          console.log(`handleAsfalistikesApodoxesChange triggered with oldValue: ${oldValue}, newVal: ${newVal}`);

          // Ενημέρωση previousValue
          previousValue = newVal;

          // Ενημέρωση asfalistikesApodoxes_XX fields (χειροκίνητη)
          updateAsfalistikesApodoxesXXManualChange(oldValue, newVal);

          // Recalculate values
          await calculateValues();
      }

      /***************************************************************
       * 10. Συνάρτηση: updateAsfalistikesApodoxesXXManualChange
       ***************************************************************/
      function updateAsfalistikesApodoxesXXManualChange(oldValue, newValue) {
          // Ενημερώνει ΟΛΑ τα πεδία, εκτός αυτών που είναι «κλειδωμένα»
          for (let i = 1; i <= 7; i++) {
              const idx = i.toString().padStart(2, '0');
              const field = document.getElementById(`asfalistikesApodoxes_${idx}`);
              if (!field) continue;

              // Αν είναι κλειδωμένο σε πλασματική, μην το αλλάζεις
              if (field.dataset.isPlasmatikh === 'true') {
                  continue;
              }

              // Αλλιώς, ενημερώνουμε
              const anotato = getAnotatoOrio(idx);
              const updatedVal = Math.min(newValue, anotato);
              field.value = formatNumberForInput(updatedVal, 2);
          }
      }

      // Κάνουμε τις συναρτήσεις global (αν χρειάζεται)
      // window.handleSynoloMiktonChange = handleSynoloMiktonChange;
      // window.handleAsfalistikesApodoxesChange = handleAsfalistikesApodoxesChange;

      /***************************************************************
       * 11. Αρχική Φόρτωση: Αρχικοποίηση και πρώτος υπολογισμός
       ***************************************************************/
      // (Α) Αρχικοποίηση (μαζί με φόρτωση πλασματικών)
      await initializeInitialValues(); 
      // (Β) Πρώτος υπολογισμός
      await calculateValues();

      // Συγχρονίζουμε το hidden πεδίο με το τρέχον asfalistikes_apodoxes
      asfalistikesApodoxesHidden.value = asfalistikesApodoxes.value;

      /***************************************************************
       * 12. Event Listeners
       ***************************************************************/
      synoloMiktonApodoxon.addEventListener('change', async () => {
          await handleSynoloMiktonChange();
      });

      // Όταν γράφει ο χρήστης μέσα στο asfalistikesApodoxes
      asfalistikesApodoxes.addEventListener('input', async () => {
          await handleAsfalistikesApodoxesChange();
      });
  }




}
