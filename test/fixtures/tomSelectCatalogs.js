'use strict';
// API-shaped, exclusively synthetic catalogs. No connection, application startup or model import.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const routes = fs.readFileSync(path.join(root, 'server/routes/dropdownRoutes.js'), 'utf8');
const imports = new Map([...routes.matchAll(/const (\w+) = require\('([^']*dropdowns[^']*)'\)/g)].map(m => [m[1], m[2]]));
const configurations = new Map();
for (const m of routes.matchAll(/router\.get\(\s*'([^']+)',\s*buildDropdownRoute\(\w+,\s*(\w+)\.options\)/g)) {
    const relative = imports.get(m[2]);
    if (!relative) throw new Error('Missing dropdown configuration: ' + m[2]);
    const file = path.resolve(root, 'server/routes', relative + '.js');
    const module = { exports: {} }, localRequire = createRequire(file);
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports,
        require: name => name.includes('/models/') ? {} : localRequire(name) }, { filename: file });
    configurations.set('/api/dropdown' + m[1], module.exports.options);
}
// The inline insurance-class mapper is also the actual application mapper.
const insuranceMapper = routes.match(/mapItem: (\(it, pad = 2\) => \{[\s\S]*?\n        \})/);
if (!insuranceMapper) throw new Error('Missing insurance-class mapper');
configurations.set('/api/dropdown/ergazomenoi/asfalistikh_klash', { mapItem: vm.runInNewContext('(' + insuranceMapper[1] + ')') });
const compactApis = new Set(['eidikothta_efka','kpk_efka','epa_efka'].map(name=>'/api/dropdown/ergazomenoi/'+name));
for(const api of compactApis)configurations.set(api,{mapItem:doc=>({value:doc.kodikos,label:`${doc.kodikos} - ${doc.perigrafh}`,kodikos:doc.kodikos,perigrafh:doc.perigrafh})});
const programFile=path.join(root,'server/dropdowns/ergazomenoi/programmataDypa.js');
const programModule={exports:{}};
vm.runInNewContext(fs.readFileSync(programFile,'utf8')+'\nmodule.exports.fixtureMapper=mapOption;',
    {module:programModule,require:()=>({})},{filename:programFile});
configurations.set('/api/dropdown/ergazomenoi/programma_dypa',{mapItem:programModule.exports.fixtureMapper});
configurations.set('/admin/user-privileges/users',{mapItem:doc=>({value:doc._id,
    label:`${doc.kodikos} — ΔΟΚΙΜΑΣΤΙΚΟΣ ΧΡΗΣΤΗΣ — test@example.invalid · TEST`,role:'U',roleLabel:'Χρήστης',active:true})});

function catalogFor(api, count = 70) {
    const pathname = new URL(api, 'https://payroll.test/').pathname;
    // Source: dropdownRoutes -> apasxolhseisBaseiSymbashs; the accepted domain is
    // checked in e3N_v1Generator and apasxoliseisReviewEmploymentProfileService.
    const fixed = pathname === '/api/dropdown/ergazomenoi/apasxolhsh_basei_symbashs';
    const documents = fixed ? [{ kodikos: '5', perigrafh: 'Πενθήμερη' }, { kodikos: '6', perigrafh: 'Εξαήμερη' }]
        : Array.from({ length: count }, (_, i) => ({
            _id: String(i + 1).padStart(24, '7'), kodikos: String(i + 1).padStart(4, '0'),
            perigrafh: `Δοκιμαστική επιλογή ${i + 1} με μακροσκελή ονομασία καταλόγου`,
            dhmos: '0001', kodikos_tameioy: '0001', afora_thn_symbash: '0001',
            eponymo:'ΔΟΚΙΜΑΣΤΙΚΟΣ',onoma:'ΕΡΓΑΖΟΜΕΝΟΣ',afm:'199999999',amka:'12345678901',
            kodikos_programmatos:String(i+1).padStart(4,'0'),titlos:`Δοκιμαστικό πρόγραμμα ${i+1}`,url_link:'https://example.invalid/',
            afora_thn_symbash_kathgoria: '00010001', afora_thn_symbash_kathgoria_eidikothta: '000100010001',
            poso: 12.28, apo_orio: 1, eos_orio: 100, isxyei_apo: '2026-01-01', isxyei_eos: '2026-12-31'
        }));
    const mapper = configurations.get(pathname)?.mapItem || ((doc, pad = 11) => ({
        value: doc.kodikos, kodikos: doc.kodikos, perigrafh: doc.perigrafh,
        label: `${doc.kodikos.padEnd(pad, '\u00a0')} - ${doc.perigrafh}`
    }));
    const pad = Number(new URL(api, 'https://payroll.test/').searchParams.get('padLength')) || 11;
    const items = documents.map(doc => mapper(doc, pad));
    return { kind: fixed ? 'fixed' : 'dynamic', items, source: pathname,
        responseKind:compactApis.has(pathname)?'custom':pathname==='/admin/user-privileges/users'?'users':'generic',
        pageSize:['/api/dropdown/ergazomenoi/programma_dypa','/admin/user-privileges/users'].includes(pathname)?items.length:50 };
}
module.exports = { catalogFor };
