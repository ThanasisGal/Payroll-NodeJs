'use strict';
// Synthetic presentation data. Never import app.js, database models or write handlers.
const path = require('node:path');
const ejs = require('ejs');
const root = path.resolve(__dirname, '../..');
const record = {
    _id: 'synthetic', id: 'synthetic', kod: '0001', kodikos: '0001', team: 'TEST', company_kod: '0001',
    eponymia: 'ΔΟΚΙΜΑΣΤΙΚΗ ΕΤΑΙΡΕΙΑ ΜΕ ΑΝΤΙΠΡΟΣΩΠΕΥΤΙΚΗ ΕΠΩΝΥΜΙΑ',
    perigrafh: 'Δοκιμαστική περιγραφή με αρκετές λέξεις για έλεγχο αναγνωσιμότητας',
    firstname: 'ΑΝΝΑ', fathername: 'ΝΙΚΟΛΑΟΣ', eponymo: 'ΔΟΚΙΜΑΣΤΙΚΟΣ', onoma: 'ΕΡΓΑΖΟΜΕΝΟΣ',
    firstName: 'ΔΟΚΙΜΑΣΤΙΚΟΣ', lastName: 'ΧΡΗΣΤΗΣ', privileges: 'U', situation: 'A',
    email: 'test@example.invalid', afm: '199999999', amka: '12345678901',
    updatedAt: new Date('2026-10-01'), createdAt: new Date('2026-10-01'),
    oristikh_enhmerosh: false, hmeromhnia_proslhpshs: '2026-10-01',
    odos: 'ΔΟΚΙΜΑΣΤΙΚΗ ΟΔΟΣ', arithmos: '24', tk: '12345', thlefono: '2101234567',
    afora_thn_symbash: '0001', afora_thn_symbash_kathgoria_eidikothta: '0001', poso_pososto: 100, pososto: 10,
    aa_eggrafhs:1, idiothtaInfo:{perigrafh:'ΝΟΜΙΜΟΣ ΕΚΠΡΟΣΩΠΟΣ'}, polhInfo:{perigrafh:'ΒΟΛΟΣ'},
    isxyei_apo:new Date('2026-01-01'), isxyei_eos:new Date('2026-12-31'),
    pososto_ergazomenoy:10, pososto_ergodoth:20, poso_ergazomenoy:0, poso_ergodoth:0,
    synolo_pososton:30, synolo_poson:0, poso_plasmatikhs_axias:0, anotato_orio_palion:0, anotato_orio_neon:0,
    sessionCount:2,totalHours:8,firstLogin:'2026-10-14',lastLogin:'2026-10-14'
};
const rows = Array.from({length:25},(_,i)=>({...record,_id:'synthetic-'+i,id:'synthetic-'+i,kod:String(i+1).padStart(4,'0'),kodikos:String(i+1).padStart(4,'0')}));
const locals = {
    ergazomenoiData: record, rec: record, companyData: { ...record, apasxolhsh_kata_tis_argies: true },
    originalEmploymentHistoryId: '', originalEmploymentHistoryRevision: '', employeeStateToken: '',
    employeeHistoryStateToken: '', employeeHistoryAccessMode: 'ADMIN_FULL', problematicHistoryIds: [],
    istorikoData: Array.from({length:3},(_,i)=>({_id:'synthetic-history-'+i,aa_eggrafhs:i+1,
        hmeromhnia_proslhpshs:'2026-01-01',hmeromhnia_allaghs_symbashs:'2026-0'+(i+2)+'-01',
        hmeromhnia_isxyos_oron_ergasias_apo:'2026-0'+(i+2)+'-01',hmeromhnia_isxyos_oron_ergasias_eos:'2026-12-31',
        hmeromhnia_lhxhs_symbashs:'2026-12-31',hmeromhnia_apoxorhshs:''})),
    orariaData: [], perifereies: [{ kodikos:'0001', perigrafh:'ΑΤΤΙΚΗ' }], genikesParametroi: [],
    sessionYearInUse: 2026, companyInUse: 'TEST', userTeam: 'TEST', sessionTeam:'TEST',
    NODE_ENV: 'development', nonce: '', csrfToken: 'synthetic', userRole: 'A', userId:'synthetic',
    userPrivileges: { admin: true, read: true, create: true, edit: true, delete: true,
        privileges: { admin: true, read: true, create: true, edit: true, delete: true } },
    CONFIG: { EGGRAFES: 20 }, script: name => '/static/js/'+name+'.js', css: () => '', mode: 'edit', context: 'ergazomenoi', users: record,
    userRoleOptions: [{ value:'U',label:'Χρήστης' },{ value:'S',label:'Επόπτης' }], normalizedUserRole: 'U',
    getUserRoleLabel: require('../../server/constants/userRoles').getUserRoleLabel,
    managedTeam: 'TEST', canManageAllTeams: false, company: record, symbaseis: record, aa_kodikos: 2,
    sTerm: 'Δοκιμή', entries: 20, basePer: 20, current: 1, pages: 2, perx: 1, showInactive: false,
    messages: {}, isAdminOrSupervisorRole: () => true, companyId:'synthetic',companyKod:'0001',companyName:record.eponymia,
    ypokatasthma:record, nomimosEkprosopos:record, antistoixish:record, passwords:record,
    kathgories:record, eidikothtes:record, stoixeiaSymbaseon:record, krathsh:record, posostaKrathseon:record,
    currentPeriod:{kodikos:'10',perigrafh:'ΟΚΤΩΒΡΙΟΣ'}, periodRec:{kodikos:'10',perigrafh:'ΟΚΤΩΒΡΙΟΣ'},
    sessionPeriodInUse:'10', sessionAppDate:'2026-10-14', sessionCompanyInUse:'synthetic',
    aa_eggrafhs:2, aa_value:2, totalRecs:25, stoixeiaSymbaseonId:'synthetic',
    env:{NODE_ENV:'development'}, currentUserId:'synthetic', month:'2026-10',
    byTeam:{TEST:[record]}, usageAnalytics:{},branches:[record],
    message:'Δοκιμαστικό μήνυμα ελέγχου εμφάνισης.', uid:'synthetic',token:'synthetic',error:'',email:record.email,
    xronos_epitrepomenhs_proorhs_apoxorhshs_se_lepta:0,
    sessionMhnas:'10',sessionEtos:2026,sessionTyposApodoxon:'01',arithmos_grammon_astheneion:3,arithmos_grammon_adeion:3,
    convertDate:()=>'2026-01-01',symbash:[record],kathgoria:[record],eidikothta:[record],
    title:'Έλεγχος εμφάνισης',description:'Συνθετικά δεδομένα',isProduction:false,appVersion:'1.9.0',
    companyDescription:record.eponymia,yearInUse:'2026',periodInUseDescr:'ΟΚΤΩΒΡΙΟΣ',appDate:'2026-10-14',
    userΝame:'ΣΥΝΘΕΤΙΚΟΣ ΧΡΗΣΤΗΣ',userΤeam:'TEST'
};
for (const key of ['companyFilteredRecs','nomimoiekprosopoi','nomimoiekprosopoiFilteredRecs',
    'passwordsFilteredRecs','trapezes','trapezesFilteredRecs','ypokatasthmata','ypokatasthmataFilteredRecs',
    'ergazomenoi','ergazomenoiFilteredRecs','symbaseisFilteredRecs','kathgoriesSymbaseonFilteredRecs',
    'eidikothtesSymbaseonFilteredRecs','stoixeiaSymbaseonFilteredRecs','krathseis','krathseisFilteredRecs',
    'tameia','teams','activeUsers']) locals[key] = rows;
locals.activeUsers=rows.slice(0,3);

function dataFor(file) {
    const data = { ...locals };
    if (file === 'views/admin/uploadTemplates.ejs') data.bodyClass = 'upload-templates-page';
    if (['views/mainapp.ejs','views/login/login.ejs','views/login/logout.ejs','views/login/verify_email.ejs'].includes(file)) data.bodyClass = 'home-bg-cdn';
    if (file === 'views/404.ejs') data.bodyClass = 'custom-background';
    if (/genikastoixeia\/(companies|search)\.ejs$/.test(file)) data.company = rows;
    if (/symbaseis\/symbaseis\/(symbaseis|search)\.ejs$/.test(file)) data.symbaseis = rows;
    if (file === 'views/index.ejs') data.users = rows;
    if (file === 'views/admin/disconnectUsers.ejs') data.users = rows;
    if (file === 'views/admin/usageReport.ejs') data.teams = ['TEST'];
    if (file === 'views/search.ejs') data.user = rows;
    if (/companies\/passwords\/(passwords|search)\.ejs$/.test(file)) data.passwords = rows;
    if (/\/add\.ejs$/.test(file)) data.mode = 'add';
    if (file.includes('companies/genikastoixeia/')) data.context = 'company';
    if (file.includes('companies/ypokatasthmata/')) data.context = 'branch';
    return data;
}
async function render(file) {
    return ejs.renderFile(path.join(root,file), dataFor(file));
}
module.exports = { root, record, locals, dataFor, render };
