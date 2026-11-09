'use strict';
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const ExcelJS=require('exceljs');
const service=require('./apasxoliseisEmploymentReviewReportService');
const {resolveEffectiveEmploymentProfileForReviewDate:resolve}=require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const {buildDailyCompensationBreakdown:compensation}=require('./apasxoliseisDailyCompensationBreakdownService');
before(()=>require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(()=>mock.restoreAll());
function data(){return {metadata:{team:'SYNTHETIC',companyName:'Συνθετική εταιρεία',branch:'0000',periodStart:'2026-06-01',periodEnd:'2026-06-30'},rows:[{
 _id:'synthetic-row',kodikos:'SYNTHETIC',employeeName:'Συνθετικός εργαζόμενος',ypokatasthma:'0000',hmeromhnia:'2026-06-03',
 kathgoria_ergasias:'ΕΡΓ',ores_ergasias:8,apo_ora_01:'08:00',eos_ora_01:'16:00',cards_apo_ora_01:'08:00',cards_eos_ora_01:'16:00',cards_ores_ergasias:8,
 effective_weekly_workdays:null,effective_weekly_hours:null,history_terms_unavailable:true,
 ...Object.fromEntries(service.DAILY_NUMBER_FIELDS.map(([field])=>[field,null])),
 compensation_breakdown_apologistika:{status:'PARTIAL_HISTORY_UNAVAILABLE',history_terms_unavailable:true,all_results_documented:false,
 unavailable_fields:service.DAILY_NUMBER_FIELDS.map(([field])=>field),total_amount:null}}]};}
test('unknown daily and accumulated hours stay null in every report projection, including findings',()=>{
 const input=data(),before=structuredClone(input),report=service.buildEmploymentReviewReportProjection(input);
 assert.equal(report.daily[0].historyPending,true);assert.ok(report.daily[0].unavailableFields.length);
 for(const [field]of service.TOTAL_NUMBER_FIELDS){assert.equal(report.daily[0].values[field],null,field);assert.equal(report.summary.totals[field],null,field);assert.equal(report.employees[0].totals[field],null,field);}
 assert.equal(report.daily[0].weeklyWorkdays,null);assert.deepEqual(input,before);
 const exportService=require('./apasxoliseisReviewExportProjectionService');
 const exported=exportService.buildReviewExportProjection({rows:input.rows,findingsOnly:true});
 assert.equal(exported.rows.length,1);assert.equal(exported.rows[0].policy.classification,'UNAVAILABLE');assert.equal(exported.rows[0].illegalOvertime.total,null);
});
test('actual XLSX bytes explicitly label unknown daily values and period totals',async()=>{
 const report=service.buildEmploymentReviewReportProjection(data());
 const bytes=await service.buildEmploymentReviewWorkbook(report).xlsx.writeBuffer();
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes);
 assert.equal(workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ').getRow(2).getCell(7).value,'Μη διαθέσιμο');
 const summary=workbook.getWorksheet('ΣΥΝΟΨΗ');let found=false;summary.eachRow(row=>{if(row.getCell(1).text==='Σύνολο — Ώρες εργασίας'){assert.equal(row.getCell(2).text,'Μη διαθέσιμο');found=true;}});assert.equal(found,true);
});
for(const dossier of [false,true])test('actual '+(dossier?'dossier':'simple')+' PDF bytes identify missing results, preserving source cards',async()=>{
 const report=service.buildEmploymentReviewReportProjection(data());const doc=service.buildEmploymentReviewPdf(report,{dossier});const chunks=[];doc.on('data',chunk=>chunks.push(chunk));const done=new Promise((resolve,reject)=>{doc.on('end',resolve);doc.on('error',reject);});doc.end();await done;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'payroll-closure-pdf-')),file=path.join(dir,dossier?'dossier.pdf':'simple.pdf');fs.writeFileSync(file,Buffer.concat(chunks));
 const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});assert.match(text,/Μη\s+διαθέσιμο/);assert.match(text,/Συνθετικός/);
});
test('a later employee wage never completes missing financial terms of the chosen historical observation',()=>{
 const f=require('../../../test/fixtures/employeeActiveHistoryFixture').employeeActiveHistoryFixture('SYNTHETIC');
 Object.assign(f.employee,{pragmatikoOromisthio:999,nomimoOromisthio:888,pososto_prosayxhshs_6hs_hmeras:99});
 for(const field of ['pragmatikoOromisthio','nomimoOromisthio','pososto_prosayxhshs_6hs_hmeras'])delete f.history[0][field];
 const before=structuredClone(f),profile=resolve({reviewDate:'2026-06-03',normalEmployee:f.employee,normalHistory:f.history});
 for(const field of ['pragmatikoOromisthio','nomimoOromisthio','pososto_prosayxhshs_6hs_hmeras'])assert.equal(profile[field],null,field);
 assert.equal(profile.all_financial_results_documented,false);
 const row={...data().rows[0],history_terms_unavailable:false,ores_ergasias_apologistika:8,ores_pragmatikhs_ergasias_apologistika:8,ores_nyxtas_apologistika:2};
 const result=compensation({row,paidHourlyRate:profile.pragmatikoOromisthio,legalHourlyRate:profile.nomimoOromisthio});
 for(const value of Object.values(result.amounts))assert.equal(value,null);assert.ok(result.reasons.includes('MISSING_PAID_HOURLY_RATE'));assert.deepEqual(f,before);
});
