'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { requireScopedEmployeeForUpdate } = require('./employeeUpdateScope');

const ROOT = path.resolve(__dirname, '../../..');
const routeSource = () => fs.readFileSync(path.join(ROOT, 'server/routes/usersRoute.js'), 'utf8');
const controllerSource = () => fs.readFileSync(path.join(__dirname,
    'ergazomenoiController.js'), 'utf8');

function response() {
    return { statusCode: 200, body: null,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; } };
}

test('η διόρθωση ιστορικού επαναχρησιμοποιεί ακριβώς το υπάρχον δικαίωμα Maintenance update', () => {
    const source = routeSource();
    const route = source.match(/router\.post\(\s*'\/api\/ergazomenoi\/update\/:ergazomenoiId'[\s\S]*?\);/u)?.[0];
    assert.ok(route);
    assert.match(route, /checkAuth/);
    assert.match(route, /requireUserPrivilegeAction\('Ergazomenoi', 'update'\)/);
    assert.match(route, /ergazomenoiController\.postErgazomenoiUpdate/);
    assert.doesNotMatch(route, /Supervisor|Admin/);
});

test('ο ελεγκτής αντλεί ομάδα, εταιρεία και κωδικό εργαζομένου από το εξουσιοδοτημένο πλαίσιο', () => {
    const source = controllerSource();
    const scopeCheck = source.indexOf('requireScopedEmployeeForUpdate({');
    const writer = source.indexOf('writeEmployeeEmploymentProfileWithAutomaticReconstruction({',
        scopeCheck);
    assert.ok(scopeCheck > 0 && writer > scopeCheck);
    const block = source.slice(scopeCheck, writer + 2500);
    assert.match(block, /team: omadaErgasias/);
    assert.match(block, /company_kod: kodikosEtaireias/);
    assert.match(block, /kodikos: kodikosErgazomenoy/);
    assert.match(block, /employeeId: ergazomenoiId/);
    assert.doesNotMatch(block, /historyId:\s*req\./);
});

test('λάθος ομάδα ή εταιρεία δεν επιστρέφει εργαζόμενο και δεν επιτρέπει καμία μετάλλαξη', async () => {
    let mutationCalls = 0;
    let filter;
    const model = {
        findOne(value) {
            filter = value;
            return { select() { return { async lean() { return null; } }; } };
        },
        updateOne() { mutationCalls += 1; },
        findOneAndUpdate() { mutationCalls += 1; }
    };
    const res = response();
    const result = await requireScopedEmployeeForUpdate({
        req: { params: { ergazomenoiId: '507f1f77bcf86cd799439011' },
            session: { userTeam: 'wrong-team', companyInUse: 'wrong-company' } },
        res, model, objectId: { isValid: () => true }
    });
    assert.equal(result, null);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(filter, { _id: '507f1f77bcf86cd799439011',
        team: 'wrong-team', company_kod: 'wrong-company' });
    assert.equal(mutationCalls, 0);
});

test('η ταυτότητα εργαζομένου του browser δεν μπορεί να αλλάξει το εξουσιοδοτημένο scope', async () => {
    const model = { findOne() { return { select() { return { async lean() {
        return { _id: '507f1f77bcf86cd799439011', kodikos: '0006' };
    } }; } }; } };
    const req = { params: { ergazomenoiId: '507f1f77bcf86cd799439011' },
        session: { userTeam: 'TEST', companyInUse: 'company' },
        body: { formData: { kodikosHidden: '9999' }, resolution: {
            historyId: 'forged-other-employee' } } };
    const result = await requireScopedEmployeeForUpdate({ req, res: response(), model,
        objectId: { isValid: () => true } });
    assert.equal(result.employeeCode, '0006');
    assert.equal(result.employeeScope.team, 'TEST');
    assert.equal(result.employeeScope.company_kod, 'company');
    assert.notEqual(result.employeeCode, req.body.formData.kodikosHidden);
});
