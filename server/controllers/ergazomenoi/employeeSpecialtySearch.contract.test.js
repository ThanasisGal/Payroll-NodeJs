const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const projectRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const controller = read('server/controllers/ergazomenoi/ergazomenoiController.js');
const listView = read('views/ergazomenoi/ergazomenoi/ergazomenoi.ejs');
const searchView = read('views/ergazomenoi/ergazomenoi/search.ejs');

function testControllerSpecialtyLookupAndSearch() {
    assert.ok(controller.includes('EidikothtesEfarmoghsModel'));
    assert.ok(controller.includes('async function getEidikothtaCodesForSearch(searchRegex)'));
    assert.ok(controller.includes('perigrafh: mongoose.trusted({ $regex: searchRegex })'));
    assert.ok(controller.includes(".select('kodikos')"));
    assert.ok(controller.includes('{ eidikothta: { $regex: re } }'));
    assert.ok(controller.includes('{ eidikothta: { $in: eidikothtaCodes } }'));
    assert.ok(controller.includes('async function attachEidikothtaDescriptions(ergazomenoi)'));
    assert.ok(controller.includes(".select('kodikos perigrafh')"));
    assert.ok(controller.includes('record.eidikothta_perigrafh || record.eidikothta'));
}

function testEmployeeViewsExposeSpecialty() {
    [listView, searchView].forEach((view, index) => {
        assert.ok(view.includes('>Ειδικότητα<'), `view ${index + 1} missing specialty heading`);
        assert.ok(view.includes('class="col-2 ergazomenoi-specialty-cell"'));
        assert.ok(view.includes('data-bs-toggle="tooltip"'));
        assert.ok(view.includes('eidikothta_perigrafh'));
        assert.ok(view.includes('|| element.eidikothta ||'));
        assert.ok(view.includes('colspan="8"'));
        assert.doesNotThrow(() => ejs.compile(view));
    });
}

testControllerSpecialtyLookupAndSearch();
testEmployeeViewsExposeSpecialty();
console.log('employee specialty search contract tests passed');
