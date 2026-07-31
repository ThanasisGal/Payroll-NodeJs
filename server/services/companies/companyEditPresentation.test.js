const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { normalizeOptionalDate } = require('./companyUpdateNormalization');
const {
    formatDateOnlyForInput,
    presentCompanyForEdit
} = require('./companyEditPresentation');

const FROM_FIELD = 'hmeromhnia_payshs_polyetias_apo';
const TO_FIELD = 'hmeromhnia_payshs_polyetias_eos';
const partialPath = path.join(
    __dirname,
    '../../../views/companies/genikastoixeia/partials/edit/cardBodies/diafora.ejs'
);
const partial = fs.readFileSync(partialPath, 'utf8');

function renderFreezeDates(company) {
    const html = ejs.render(partial, { company, nonce: '' }, { filename: partialPath });
    const values = {};
    for (const field of [FROM_FIELD, TO_FIELD]) {
        const input = html.match(new RegExp(`<input[^>]+name="${field}"[^>]*>`, 's'))?.[0];
        assert.ok(input, `missing ${field} input`);
        values[field] = input.match(/value="([^"]*)"/)?.[1];
    }
    return { html, values };
}

const mongoDates = presentCompanyForEdit({
    [FROM_FIELD]: new Date('2012-02-14T00:00:00.000Z'),
    [TO_FIELD]: new Date('2023-03-31T00:00:00.000Z')
});
assert.deepStrictEqual(renderFreezeDates(mongoDates).values, {
    [FROM_FIELD]: '2012-02-14',
    [TO_FIELD]: '2023-03-31'
});

const isoDates = presentCompanyForEdit({
    [FROM_FIELD]: '2012-02-14T00:00:00.000Z',
    [TO_FIELD]: '2023-03-31T00:00:00.000Z'
});
const isoRender = renderFreezeDates(isoDates);
assert.deepStrictEqual(isoRender.values, {
    [FROM_FIELD]: '2012-02-14',
    [TO_FIELD]: '2023-03-31'
});
assert.doesNotMatch(isoRender.html, /value="[^"]*T00:00:00/);

for (const empty of [null, undefined, '']) {
    const rendered = renderFreezeDates(
        presentCompanyForEdit({ [FROM_FIELD]: empty, [TO_FIELD]: empty })
    );
    assert.strictEqual(rendered.values[FROM_FIELD], '');
    assert.strictEqual(rendered.values[TO_FIELD], '');
}

assert.strictEqual(
    formatDateOnlyForInput(new Date('2012-02-14T00:00:00.000Z')),
    '2012-02-14'
);
assert.strictEqual(formatDateOnlyForInput('not-a-date'), '');

const postedFrom = normalizeOptionalDate('2012-02-14', FROM_FIELD);
const postedTo = normalizeOptionalDate('2023-03-31', TO_FIELD);
const roundTrip = renderFreezeDates(
    presentCompanyForEdit({ [FROM_FIELD]: postedFrom, [TO_FIELD]: postedTo })
);
assert.deepStrictEqual(roundTrip.values, {
    [FROM_FIELD]: '2012-02-14',
    [TO_FIELD]: '2023-03-31'
});

console.log('PASS company freeze date edit presentation and round-trip contract');
