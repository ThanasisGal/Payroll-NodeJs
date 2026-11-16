'use strict';
const F=require('./employee0002HistoryProposalFixture');
const X=require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const C=require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
async function importSample(operation='UPDATE',data=F.employee0002HistoryProposalFixture(),catalogs=F.catalogs){
    let selection=`UPDATE:${data.completeHistoryRows[0]._id}`;
    if(operation==='INSERT'){
        const initial=await X.buildEmployeeHistoryProposalWorkbook(data,catalogs);
        selection=`INSERT:${initial.caseSelection.cases.find(item=>item.operation==='INSERT').id}`;
    }
    const result=await X.buildEmployeeHistoryProposalWorkbook(data,catalogs,{selection});
    const set=(field,value)=>{
        const entry=result.editableCells.find(entry=>entry.canonicalField===field||entry.role===field);
        result.workbook.getWorksheet(entry.sheet).getCell(entry.cell).value=value;
    };
    set('nomimosMisthos',1234.56);set('EVIDENCE','Συνθετικό έγγραφο για οπτικό έλεγχο — κανένα πραγματικό στοιχείο');
    set('DECLARATION','Δηλώνω τεκμηριωμένα στοιχεία');
    if(operation==='UPDATE'){
        set(C.CHANGE,new Date('2026-02-03T00:00:00Z'));
        set('eidikothta_symbashs','01');
    }
    return {data,catalogs,selection,result,buffer:await X.serializeEmployeeHistoryProposalWorkbook(result.workbook)};
}
function legacyImportMetadataFixture(){
    const data=F.employee0002HistoryProposalFixture({reviewRequired:false});
    // Synthetic legacy omission outside the manually selected UPDATE. The
    // complete planner cannot certify this history; the selected row remains
    // readable and the independent workbook snapshot still binds every row.
    delete data.completeHistoryRows[1][C.HIRE];
    data.completeHistoryRows[0].eidikothta_symbashs='01';
    return data;
}
module.exports={importSample,legacyImportMetadataFixture};
