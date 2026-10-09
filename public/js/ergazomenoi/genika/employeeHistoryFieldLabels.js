'use strict';

// One Greek label source for the existing details modal and the read-only preview.
(function (root) {
    const labels = {
        aa_eggrafhs: 'α/α Εγγραφής',
        hmeromhnia_proslhpshs: 'Ημ/νία Πρόσληψης',
        hmeromhnia_allaghs_symbashs: 'Ημ/νία Αλλαγής Σύμβασης',
        hmeromhnia_allaghs_orarioy_apo: 'Ημ/νία Αλλαγής Ωραρίου Από',
        hmeromhnia_allaghs_orarioy_eos: 'Ημ/νία Αλλαγής Ωραρίου Έως',
        hmeromhnia_isxyos_oron_ergasias_apo: 'Ημ/νία Ισχύος Όρων Εργασίας Από',
        hmeromhnia_isxyos_oron_ergasias_eos: 'Ημ/νία Ισχύος Όρων Εργασίας Έως',
        hmeromhnia_lhxhs_symbashs: 'Ημ/νία Λήξης Σύμβασης',
        hmeromhnia_apoxorhshs: 'Ημ/νία Αποχώρησης',
        afora_proslhpsh: 'Αφορά Πρόσληψη',
        kathestos_apasxolhshs: 'Καθεστώς Απασχόλησης',
        hmeres_ergasias_ebdomadas: 'Ημέρες Εργασίας Εβδομάδας',
        ores_ergasias_ebdomadas: 'Ώρες Εργασίας Εβδομάδας',
        mo_oron_hmerhsias_ergasias: 'Μ.Ο. Ημερήσιας Εργασίας',
        pososto_prosayxhshs_6hs_hmeras: 'Προσαύξηση 6ης Ημέρας (%)',
        typos_apasxolhshs: 'Τύπος Απασχόλησης',
        typos_ebdomadas: 'Απασχόληση Βάσει Σύμβασης',
        afora_allagh_oron_ergasias: 'Αφορά Αλλαγή Όρων Εργασίας',
        misthologiko_klimakio: 'Μισθολογικό Κλιμάκιο',
        synolo_symbashs: 'Σύνολο Σύμβασης',
        synolo_symbashs_basei_oron_ergasias: 'Σύνολο Σύμβασης Βάσει Όρων Εργασίας',
        nomimosMisthos: 'Νόμιμος Μισθός',
        nomimoHmeromisthio: 'Νόμιμο Ημερομίσθιο',
        nomimoOromisthio: 'Νόμιμο Ωρομίσθιο',
        pragmatikosMisthos: 'Πραγματικός Μισθός',
        pragmatikoHmeromisthio: 'Πραγματικό Ημερομίσθιο',
        pragmatikoOromisthio: 'Πραγματικό Ωρομίσθιο',
        eidikh_kathgoria_ergazomenoy: 'Ειδική Κατηγορία Εργαζόμενου',
        eidikh_periptosh: 'Ειδική Περίπτωση',
        typos_ergazomenon: 'Τύπος Εργαζόμενου',
        afora_egkekrimenh_rythmish_ergasias: 'Αφορά Εγκεκριμένη Ρύθμιση Εργασίας',
        hmnia_enarxhs_egkekrimenhs_rythmishs: 'Ημ/νία Έναρξης Εγκεκριμένης Ρύθμισης',
        hmnia_lhxhs_egkekrimenhs_rythmishs: 'Ημ/νία Λήξης Εγκεκριμένης Ρύθμισης',
        hmeres_efarmoghs_egkekrimenhs_rythmishs: 'Ημέρες Εφαρμογής Εγκεκριμένης Ρύθμισης',
        typos_egkekrimenhs_rythmishs: 'Τύπος Εγκεκριμένης Ρύθμισης',
        diakoph_apo_ora_egkekrimenhs_rythmishs: 'Διακοπή Εγκεκριμένης Ρύθμισης Από Ώρα',
        diakoph_eos_ora_egkekrimenhs_rythmishs: 'Διακοπή Εγκεκριμένης Ρύθμισης Έως Ώρα',
        kathgoria_adeias_egkekrimenhs_rythmishs: 'Κατηγορία Άδειας Εγκεκριμένης Ρύθμισης',
        dialleima_apo_ora_01: 'Διάλειμμα 1 Από Ώρα',
        dialleima_eos_ora_01: 'Διάλειμμα 1 Έως Ώρα',
        dialleima_apo_ora_02: 'Διάλειμμα 2 Από Ώρα',
        dialleima_eos_ora_02: 'Διάλειμμα 2 Έως Ώρα',
        dialleima_apo_ora_03: 'Διάλειμμα 3 Από Ώρα',
        dialleima_eos_ora_03: 'Διάλειμμα 3 Έως Ώρα',
        afora_allagh_dialleimatos: 'Αφορά Αλλαγή Διαλείμματος',
        hmeromhnia_isxyos_dialleimatos_apo: 'Ημ/νία Ισχύος Διαλείμματος Από',
        dialleima_se_lepta: 'Διάρκεια Διαλείμματος (Λεπτά)',
        dialleima_entos_ektos_orarioy: 'Διάλειμμα Εντός / Εκτός Ωραρίου',
        synexes_diakekomeno: 'Συνεχές / Διακεκομμένο Ωράριο',
        typos_orarioy: 'Τύπος Ωραρίου',
        evelikth_proselefsh: 'Ευέλικτη Προσέλευση',
        symbatikes_ores_ergasias: 'Συμβατικές Ώρες Εργασίας',

        symbash: 'Σύμβαση',
        kathgoria_symbashs: 'Κατηγορία Σύμβασης',
        eidikothta_symbashs: 'Ειδικότητα Σύμβασης'
    };
    for (let i = 1; i <= 15; i += 1) {
        const n = String(i).padStart(2, '0');
        labels[`stoixeio_symbashs_${n}`] = `Στοιχείο Σύμβασης ${n}`;
        labels[`poso_symbashs_${n}`] = `Ποσό Σύμβασης ${n}`;
        labels[`poso_symbashs_basei_oron_ergasias_${n}`] = `Ποσό Βάσει Όρων Εργασίας ${n}`;
    }
    for (let i = 1; i <= 7; i += 1) {
        const n = String(i).padStart(2, '0');
        labels[`krathsh_${n}`] = i === 1 ? 'Κωδικός Πακέτου Κάλυψης (ΚΠΚ)' : `Κράτηση ${n}`;
    }
    Object.freeze(labels);
    if (typeof module === 'object' && module.exports) module.exports = labels;
    else root.employeeHistoryFieldLabels = labels;
})(globalThis);
