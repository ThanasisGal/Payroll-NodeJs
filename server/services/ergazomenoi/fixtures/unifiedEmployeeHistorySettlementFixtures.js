'use strict';
// Reusable synthetic business families. No database, employee export or credentials.
const { clone } = require('../employeeHistoryAutomaticSettlementPreparationContract');
const scope = Object.freeze({ team: 'SYNTHETIC', company_kod: '610000000000000000000001', kodikos: 'SYNTHETIC-HISTORY' });
const identity = n => `6200000000000000${String(n).padStart(8,'0')}`;
function period(n, { hire = '2026-01-01', from = hire, to = null, departure = null, pay = 1200,
    days = 5, hours = 40, ...extra } = {}) {
    return { ...scope, _id: identity(n), aa_eggrafhs: String(n).padStart(4,'0'),
        hmeromhnia_proslhpshs: hire, hmeromhnia_isxyos_oron_ergasias_apo: from,
        hmeromhnia_isxyos_oron_ergasias_eos: to, hmeromhnia_apoxorhshs: departure,
        hmeromhnia_allaghs_symbashs: from, afora_proslhpsh: from === hire,
        afora_allagh_oron_ergasias: true, hmeres_ergasias_ebdomadas: days,
        ores_ergasias_ebdomadas: hours, mo_oron_hmerhsias_ergasias: hours/days,
        synolo_symbashs: pay, pragmatikosMisthos: pay, nomimosMisthos: 1000,
        evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40,
        typos_ebdomadas: days === 6 ? '6HMERH' : '5HMERH',
        kathestos_apasxolhshs: hours === 40 ? '0' : '2',
        dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: false,
        synexes_diakekomeno: false, typos_orarioy: false,
        symbash: 'SYNTHETIC_CONTRACT', eidikothta_symbashs: 'SYNTHETIC_SPECIALTY',
        createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'), ...extra };
}
function input(rows = [period(1)], current = rows.at(-1)) {
    return { scope: { ...scope }, currentEmployee: { ...clone(current), _id: identity(900), energos: !current.hmeromhnia_apoxorhshs },
        completeHistoryRows: clone(rows), protectedReferenceSummary: Object.fromEntries(rows.map(row => [String(row._id),[]])) };
}
function references(data, mode = 'all') {
    for (const [index,row] of data.completeHistoryRows.entries()) data.protectedReferenceSummary[String(row._id)] =
        mode === 'none' || mode === 'first' && index > 0 ? [] : [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots',
            historyId: String(row._id), documentId: `synthetic-snapshot-${index}`,
            frozen_snapshot: { finalized: true, daily_results: [{ amount: 123.45, minutes: 480,
                effective_profile_istoriko_id: String(row._id) }] } }];
    return data;
}
function initialGap() {
    return input([period(1, { hire:'2026-02-02',from:'2026-04-01',to:'2026-09-28',pay:1100 }),
        period(2, { hire:'2026-02-02',from:'2026-09-29',to:'2027-01-31',pay:1300 })]);
}
function intermediate(different = false) {
    return input([period(1, {to:'2026-03-31'}),period(2,{from:'2026-04-10',pay:different?1400:1200})]);
}
function duplicates(complementary = false) {
    const data = input([period(1),period(2)]);
    if (complementary) { delete data.completeHistoryRows[0].eidikothta_symbashs; delete data.completeHistoryRows[1].synolo_symbashs; }
    return data;
}
function overlap(different = false) {
    return input([period(1,{to:'2026-05-31'}),period(2,{from:'2026-04-01',pay:different?1400:1200})]);
}
function payAlternatives() {
    return input([period(1,{to:'2026-03-31',pay:1100}),period(2,{to:'2026-03-31',pay:1300}),
        period(3,{from:'2026-04-01',pay:1500})]);
}
function rehire() {
    return input([period(1,{hire:'2025-12-01',to:'2026-07-31',departure:'2026-07-31'}),
        period(2,{hire:'2025-12-01',to:'2026-07-31'}),period(3,{hire:'2026-09-16'})]);
}
function openPast() {
    const data = rehire(); data.completeHistoryRows.slice(0,2).forEach(row => {row.hmeromhnia_apoxorhshs=null;row.hmeromhnia_isxyos_oron_ergasias_eos=null;}); return data;
}
function clean() { return input(); }
function technical() {
    const data = clean(); const row={...scope,_id:identity(2),aa_eggrafhs:'0002',hmeromhnia_proslhpshs:'2026-01-01',
        afora_allagh_oron_ergasias:false,hmeromhnia_allaghs_orarioy_apo:'2026-06-01',hmeromhnia_allaghs_orarioy_eos:'2026-06-30'};
    data.completeHistoryRows.push(row);data.protectedReferenceSummary[String(row._id)]=[];return data;
}
function unknownArrival() { const data=clean();for(const row of [data.currentEmployee,...data.completeHistoryRows]) delete row.evelikth_proselefsh;return data; }
function contradiction() {const data=rehire();data.completeHistoryRows[1].hmeromhnia_apoxorhshs='2026-08-10';return data;}
function withdrawn() {const data=clean();const row=period(2,{hire:'2020-01-01',pay:999999});row.employment_history_canonical_status='WITHDRAWN_ERRONEOUS';row.hmeromhnia_isxyos_oron_ergasias_apo='invalid-date';data.completeHistoryRows.push(row);data.protectedReferenceSummary[String(row._id)]=[];return data;}
const families = [
    [1,'Ιστορικό εντελώς κενό με τεκμηριωμένη πρόσληψη',()=>input([],period(1)),'AUTOMATIC'],
    [2,'Αρχικό κενό από πρόσληψη έως πρώτη μεταβολή',initialGap,'AUTOMATIC'],
    [3,'Ενδιάμεσο κενό μεταξύ ίδιων εργασιακών όρων',()=>intermediate(false),'AUTOMATIC'],
    [4,'Ενδιάμεσο κενό μεταξύ διαφορετικών όρων',()=>intermediate(true),'AUTOMATIC'],
    [5,'Απόλυτα όμοιες διπλές εγγραφές',()=>duplicates(false),'AUTOMATIC'],
    [6,'Διπλές εγγραφές με συμπληρωματικά στοιχεία',()=>duplicates(true),'AUTOMATIC'],
    [7,'Επικάλυψη με ίδιους όρους',()=>overlap(false),'AUTOMATIC'],
    [8,'Επικάλυψη με διαφορετικούς πραγματικούς όρους',()=>overlap(true),'AUTOMATIC'],
    [9,'Πραγματική διάσπαση περιόδου',()=>{const d=require('../../../../test/fixtures/employeeHistoryPeriodSplitFixture').periodSplitFixture({yearly:true});return d;},'AUTOMATIC'],
    [10,'Δύο ή περισσότερες πραγματικές αλλαγές',()=>input([period(1,{to:'2026-04-20',pay:1100}),period(2,{from:'2026-04-01',to:'2026-07-20',pay:1250}),period(3,{from:'2026-07-01',pay:1450})]),'AUTOMATIC'],
    [11,'Διπλές εγγραφές με διαφορετικές οικονομικές τιμές',payAlternatives,'BUSINESS_DECISION_REQUIRED'],
    [12,'Πραγματική μεταβολή αποδοχών',()=>input([period(1,{to:'2026-03-31',pay:1100}),period(2,{from:'2026-04-01',pay:1300})]),'CLEAN'],
    [13,'Ελλιπή μη κρίσιμα αριθμητικά στοιχεία',()=>{const d=clean();delete d.currentEmployee.misthologiko_klimakio;delete d.completeHistoryRows[0].misthologiko_klimakio;return d;},'CLEAN'],
    [14,'Άγνωστα στοιχεία ευέλικτης προσέλευσης',unknownArrival,'BUSINESS_DECISION_REQUIRED'],
    [15,'Πενθήμερο, εξαήμερο, εκ περιτροπής απασχόληση',clean,'CLEAN'],
    [16,'Αποχώρηση και μεταγενέστερη επαναπρόσληψη',rehire,'AUTOMATIC'],
    [17,'Παλαιός κύκλος χωρίς σωστή λήξη',openPast,'ADMIN_REQUIRED'],
    [18,'Τεχνικές εγγραφές ωραρίου',technical,'CLEAN'],
    [19,'Μεταβολή σύμβασης και αλλαγή ειδικότητας',()=>{const d=overlap(true);Object.assign(d.completeHistoryRows[1],{symbash:'SYNTHETIC_OTHER_CONTRACT',eidikothta_symbashs:'SYNTHETIC_OTHER_SPECIALTY'});Object.assign(d.currentEmployee,d.completeHistoryRows[1],{_id:identity(900)});return d;},'AUTOMATIC'],
    [20,'Προστατευμένες ιστορικές εγγραφές',()=>references(overlap(true)),'AUTOMATIC'],
    [21,'Οριστικοποιημένα αποτελέσματα και snapshots',()=>references(duplicates(true)),'AUTOMATIC'],
    [22,'Άγνωστες ή ασύμβατες ιστορικές αναφορές',()=>{const d=clean();d.protectedReferenceSummary[String(d.completeHistoryRows[0]._id)]=[{collection:'Unsupported_Synthetic_Reference'}];return d;},'ADMIN_REQUIRED'],
    [23,'Ήδη καθαρό Ιστορικό',clean,'CLEAN'],
    [24,'Επανεκτέλεση μετά από επιτυχή τακτοποίηση',()=>duplicates(false),'AUTOMATIC'],
    [25,'Ταυτόχρονη αλλαγή άλλου χρήστη',payAlternatives,'BUSINESS_DECISION_REQUIRED'],
    [26,'Μη υποστηριζόμενη πραγματική αντίφαση',contradiction,'ADMIN_REQUIRED'],
    [27,'Ιστορικό με αποσυρμένες εσφαλμένες εγγραφές',withdrawn,'CLEAN'],
    [28,'Ανεξάρτητη καθημερινή συντήρηση παρά ιστορική εκκρεμότητα',openPast,'ADMIN_REQUIRED']
].map(([number,name,make,expected])=>({number,name,make,expected}));
module.exports = {scope,identity,period,input,references,initialGap,intermediate,duplicates,overlap,payAlternatives,rehire,openPast,unknownArrival,withdrawn,families};

// More than two independent ambiguous periods: each gets a small factual choice,
// without multiplying the number of visible options across the whole History.
module.exports.threeIndependentAlternatives = () => input([
    period(1,{to:'2026-02-28',pay:1100}),period(2,{to:'2026-02-28',pay:1200}),
    period(3,{from:'2026-03-01',to:'2026-04-30',pay:1300}),period(4,{from:'2026-03-01',to:'2026-04-30',pay:1400}),
    period(5,{from:'2026-05-01',to:'2026-06-30',pay:1500}),period(6,{from:'2026-05-01',to:'2026-06-30',pay:1600}),
    period(7,{from:'2026-07-01',pay:1700})]);
